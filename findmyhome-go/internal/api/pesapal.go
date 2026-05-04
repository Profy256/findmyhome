package api

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"

	"findmyhome/backend/internal/model"
)

func (s *Server) initiatePesapal(ctx context.Context, orderID string, amount int64, description string, buyer *model.User) string {
	if strings.TrimSpace(s.Cfg.PesapalConsumerKey) == "" || strings.TrimSpace(s.Cfg.PesapalConsumerSecret) == "" {
		return ""
	}

	token, err := pesapalRequestToken(ctx, s)
	if err != nil || token == "" {
		return ""
	}

	base := pesapalBaseEnv(s)
	payload := map[string]any{
		"id":           orderID,
		"currency":     "UGX",
		"amount":       amount,
		"description":  description,
		"callback_url": strings.TrimRight(s.Cfg.PublicAPIURL, "/") + "/api/payments/ipn",
		"billing_address": map[string]any{
			"email_address": buyer.Email,
			"phone_number":  buyer.Phone,
			"first_name":    firstToken(buyer.Name),
			"last_name":     lastToken(buyer.Name),
		},
	}
	bt, _ := json.Marshal(payload)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, base+"/api/Transactions/SubmitOrderRequest", bytes.NewReader(bt))
	if err != nil {
		return ""
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()

	var out struct {
		RedirectURL string `json:"redirect_url"`
	}
	if json.NewDecoder(resp.Body).Decode(&out) != nil || out.RedirectURL == "" {
		return ""
	}
	return out.RedirectURL
}

func firstToken(name string) string {
	parts := strings.Fields(strings.TrimSpace(name))
	if len(parts) == 0 {
		return "Guest"
	}
	return parts[0]
}

func lastToken(name string) string {
	parts := strings.Fields(strings.TrimSpace(name))
	if len(parts) <= 1 {
		return ""
	}
	return parts[len(parts)-1]
}

func pesapalBaseEnv(s *Server) string {
	if strings.EqualFold(strings.TrimSpace(s.Cfg.PesapalEnv), "production") {
		return "https://pay.pesapal.com/v3"
	}
	return "https://cybqa.pesapal.com/pesapalv3"
}

func pesapalRequestToken(ctx context.Context, s *Server) (string, error) {
	base := pesapalBaseEnv(s)
	body := map[string]string{
		"consumer_key":    s.Cfg.PesapalConsumerKey,
		"consumer_secret": s.Cfg.PesapalConsumerSecret,
	}
	bt, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, base+"/api/Auth/RequestToken", bytes.NewReader(bt))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var tok struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tok); err != nil {
		return "", err
	}
	return tok.Token, nil
}

func (s *Server) pesapalIPN(c *gin.Context) {
	tracking, merchant := "", ""
	contentType := c.GetHeader("Content-Type")

	switch {
	case strings.Contains(strings.ToLower(contentType), "application/json"):
		var m map[string]any
		b, _ := io.ReadAll(c.Request.Body)
		_ = json.Unmarshal(b, &m)
		if v, ok := m["OrderTrackingId"].(string); ok {
			tracking = v
		}
		if v, ok := m["OrderMerchantReference"].(string); ok {
			merchant = v
		}
	default:
		_ = c.Request.ParseForm()
		tracking = c.Request.FormValue("OrderTrackingId")
		merchant = c.Request.FormValue("OrderMerchantReference")
	}

	if tracking == "" || merchant == "" {
		c.JSON(http.StatusBadRequest, map[string]string{"message": "Invalid IPN data."})
		return
	}

	var bid string
	if err := s.Pool.QueryRow(c.Request.Context(), `
		SELECT id::text FROM bookings WHERE pesapal_order_id=$1 LIMIT 1
	`, merchant).Scan(&bid); err != nil {
		c.JSON(http.StatusNotFound, map[string]string{"message": "Booking not found."})
		return
	}
	_ = bid

	token, err := pesapalRequestToken(c.Request.Context(), s)
	if err == nil && token != "" {
		desc := pesapalTxnStatus(c.Request.Context(), s, token, tracking)
		if strings.EqualFold(strings.TrimSpace(desc), "COMPLETED") {
			_, _ = s.Pool.Exec(c.Request.Context(), `
				UPDATE bookings SET payment_status='paid', pesapal_tracking_id=$2, updated_at=NOW()
				WHERE pesapal_order_id=$1
			`, merchant, tracking)
		}
	}

	c.JSON(http.StatusOK, map[string]string{
		"OrderNotificationType": "IPNCHANGE",
		"OrderTrackingId":       tracking,
	})
}

func pesapalTxnStatus(ctx context.Context, s *Server, token, tracking string) string {
	base := pesapalBaseEnv(s)

	q := url.Values{}
	q.Set("orderTrackingId", tracking)
	reqURL := base + "/api/Transactions/GetTransactionStatus?" + q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return ""
	}
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()

	var out struct {
		PaymentStatusDescription string `json:"payment_status_description"`
	}
	if json.NewDecoder(resp.Body).Decode(&out) != nil {
		return ""
	}
	return out.PaymentStatusDescription
}
