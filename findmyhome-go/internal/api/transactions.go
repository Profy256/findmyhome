package api

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"math"
	"net/http"
	"strings"
	"time"

	"findmyhome/backend/internal/repo"
	"findmyhome/backend/internal/response"
)

func (s *Server) transactionStore(c *gin.Context) {
	me, ok := UserFromContext(c.Request.Context())
	if !ok || me == nil {
		return
	}

	var body struct {
		PropertyID  uuid.UUID `json:"property_id"`
		AgreedPrice int64     `json:"agreed_price"`
		BuyerID     uuid.UUID `json:"buyer_id"`
	}
	if err := json.NewDecoder(c.Request.Body).Decode(&body); err != nil {
		jsonErr(c, http.StatusBadRequest, "Invalid JSON.")
		return
	}
	if body.AgreedPrice < 1 {
		writeValidation(c, "Validation failed.", map[string][]string{"agreed_price": {"invalid"}})
		return
	}

	var seller uuid.UUID
	var propStatus string
	err := s.Pool.QueryRow(c.Request.Context(), `
		SELECT seller_id, status::text FROM properties WHERE id=$1 AND deleted_at IS NULL
	`, body.PropertyID).Scan(&seller, &propStatus)
	if err != nil {
		writeValidation(c, "Validation failed.", map[string][]string{"property_id": {"invalid"}})
		return
	}
	if propStatus != "active" {
		jsonErr(c, http.StatusUnprocessableEntity, "This property is no longer available.")
		return
	}

	var existing uuid.UUID
	if err := s.Pool.QueryRow(c.Request.Context(), `
		SELECT id FROM transactions WHERE property_id=$1 AND completed_at IS NULL LIMIT 1
	`, body.PropertyID).Scan(&existing); err == nil {
		c.JSON(http.StatusUnprocessableEntity, map[string]any{
			"message":     "A transaction is already in progress for this property.",
			"transaction": map[string]string{"id": existing.String()},
		})
		return
	} else if !errors.Is(err, pgx.ErrNoRows) {
		jsonErr(c, http.StatusInternalServerError, "Could not create transaction.")
		return
	}

	isBuyer := me.Role == "buyer"
	buyerID := me.ID
	if !isBuyer {
		if body.BuyerID == uuid.Nil {
			jsonErr(c, http.StatusUnprocessableEntity, "buyer_id is required.")
			return
		}
		buyerID = body.BuyerID
	}

	ctx := c.Request.Context()
	now := time.Now()

	var bt, st any
	buyerConfirmed := isBuyer
	sellerConfirmed := !isBuyer
	if buyerConfirmed {
		bt = now
	}
	if sellerConfirmed {
		st = now
	}

	var tid string
	err = s.Pool.QueryRow(ctx, `
		INSERT INTO transactions (
		  buyer_id, seller_id, property_id, agreed_price,
		  buyer_confirmed, seller_confirmed,
		  buyer_confirmed_at, seller_confirmed_at,
		  created_at, updated_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
		RETURNING id::text
	`, buyerID, seller, body.PropertyID, body.AgreedPrice, buyerConfirmed, sellerConfirmed, bt, st).Scan(&tid)
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not create transaction.")
		return
	}

	c.JSON(http.StatusCreated, map[string]any{
		"message":     "Transaction created. Waiting for the other party to confirm.",
		"transaction": map[string]any{"id": tid},
	})
}

func (s *Server) transactionConfirm(c *gin.Context) {
	me, ok := UserFromContext(c.Request.Context())
	if !ok || me == nil {
		return
	}

	txid, err := uuid.Parse(c.Param("transaction"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}

	var buyer, seller, property uuid.UUID
	var agreed int64
	var bc, sc bool
	var completed *time.Time
	ctx := c.Request.Context()
	err = s.Pool.QueryRow(ctx, `
		SELECT buyer_id, seller_id, property_id, agreed_price, buyer_confirmed, seller_confirmed, completed_at
		FROM transactions WHERE id=$1
	`, txid).Scan(&buyer, &seller, &property, &agreed, &bc, &sc, &completed)
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}

	if completed != nil {
		jsonErr(c, http.StatusUnprocessableEntity, "This transaction is already completed.")
		return
	}
	if me.ID != buyer && me.ID != seller {
		jsonErr(c, http.StatusForbidden, "Unauthorized.")
		return
	}

	if me.ID == buyer && bc {
		jsonErr(c, http.StatusUnprocessableEntity, "You have already confirmed this transaction.")
		return
	}
	if me.ID == seller && sc {
		jsonErr(c, http.StatusUnprocessableEntity, "You have already confirmed this transaction.")
		return
	}

	if me.ID == buyer {
		_, err = s.Pool.Exec(ctx, `UPDATE transactions SET buyer_confirmed=TRUE, buyer_confirmed_at=NOW(), updated_at=NOW() WHERE id=$1 AND buyer_confirmed=FALSE`, txid)
	} else {
		_, err = s.Pool.Exec(ctx, `UPDATE transactions SET seller_confirmed=TRUE, seller_confirmed_at=NOW(), updated_at=NOW() WHERE id=$1 AND seller_confirmed=FALSE`, txid)
	}
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not update transaction.")
		return
	}

	if err := s.Pool.QueryRow(ctx, `
		SELECT buyer_confirmed, seller_confirmed FROM transactions WHERE id=$1
	`, txid).Scan(&bc, &sc); err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not reload transaction.")
		return
	}

	if bc && sc {
		if err := s.finalizeDeal(ctx, txid, seller, property, agreed); err != nil {
			jsonErr(c, http.StatusInternalServerError, "Could not finalize transaction.")
			return
		}

		listing := ""
		_ = s.Pool.QueryRow(ctx, `SELECT listing_type::text FROM properties WHERE id=$1`, property).Scan(&listing)
		word := "sold"
		if listing != "sale" {
			word = "rented"
		}

		var cid string
		_ = s.Pool.QueryRow(ctx, `SELECT id::text FROM commissions WHERE transaction_id=$1 ORDER BY created_at DESC LIMIT 1`, txid).Scan(&cid)

		c.JSON(http.StatusOK, map[string]any{
			"message":     "Transaction confirmed by both parties. Property is now marked as " + word + ".",
			"transaction": map[string]string{"id": txid.String()},
			"commission":  map[string]string{"id": cid},
		})
		return
	}

	waitingFor := "seller"
	if !bc {
		waitingFor = "buyer"
	}

	c.JSON(http.StatusOK, map[string]any{
		"message":     "Your confirmation recorded. Waiting for the " + waitingFor + " to confirm.",
		"transaction": map[string]string{"id": txid.String()},
		"waiting_for": waitingFor,
	})
}

func (s *Server) finalizeDeal(ctx context.Context, txid, sellerID, propertyID uuid.UUID, agreed int64) error {
	var listing string
	err := s.Pool.QueryRow(ctx, `SELECT listing_type::text FROM properties WHERE id=$1`, propertyID).Scan(&listing)
	if err != nil {
		return err
	}

	nextStatus := "sold"
	if listing != "sale" {
		nextStatus = "rented"
	}

	if _, err := s.Pool.Exec(ctx, `UPDATE properties SET status=$2, updated_at=NOW() WHERE id=$1`, propertyID, nextStatus); err != nil {
		return err
	}

	if _, err := s.Pool.Exec(ctx, `UPDATE transactions SET completed_at=NOW(), updated_at=NOW() WHERE id=$1`, txid); err != nil {
		return err
	}

	sellerRow, err := repo.GetUser(ctx, s.Pool, sellerID)
	if err != nil {
		return err
	}

	rate := effectiveCommissionRate(ctx, s.Pool, sellerRow)
	dueDays := repo.SettingInt(ctx, s.Pool, "commission_due_days", 14)
	commissionAmt := int64(math.Round(float64(agreed) * (rate / 100.0)))

	dueDate := time.Now().UTC().AddDate(0, 0, dueDays)

	_, err = s.Pool.Exec(ctx, `
		INSERT INTO commissions (
		  seller_id, transaction_id, property_price, commission_amount,
		  status, due_date, created_at, updated_at
		) VALUES ($1,$2,$3,$4,'pending',$5::date,NOW(),NOW())
	`, sellerID, txid, agreed, commissionAmt, dueDate.Format("2006-01-02"))
	return err
}

func (s *Server) myTransactions(c *gin.Context) {
	me, ok := UserFromContext(c.Request.Context())
	if !ok || me == nil {
		return
	}

	page := parsePageReq(c.Request)
	perPage := 20
	offset := (page - 1) * perPage

	ctx := c.Request.Context()
	var total int64
	if err := s.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM transactions WHERE buyer_id=$1 OR seller_id=$1
	`, me.ID).Scan(&total); err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not load.")
		return
	}

	rows, err := s.Pool.Query(ctx, `
		SELECT t.id::text,
		       t.buyer_confirmed, t.seller_confirmed,
		       t.agreed_price,
		       t.buyer_confirmed_at, t.seller_confirmed_at, t.completed_at,
		       t.created_at,
		       prop.id::text, prop.title, prop.location, prop.price::bigint, prop.listing_type::text,
		       buyer.id::text, buyer.name, buyer.phone,
		       seller.id::text, seller.name, seller.phone, seller.company_name,
		       c.id::text, c.commission_amount, c.status::text, c.due_date
		FROM transactions t
		JOIN properties prop ON prop.id=t.property_id
		JOIN users buyer ON buyer.id=t.buyer_id
		JOIN users seller ON seller.id=t.seller_id
		LEFT JOIN commissions c ON c.transaction_id=t.id
		WHERE t.buyer_id=$1 OR t.seller_id=$1
		ORDER BY t.created_at DESC
		LIMIT $2 OFFSET $3
	`, me.ID, perPage, offset)
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not load.")
		return
	}
	defer rows.Close()

	items := []map[string]any{}
	for rows.Next() {
		var id string
		var bc, sc bool
		var agreed int64
		var bcat, scAt *time.Time
		var completed *time.Time
		var created time.Time

		var pid string
		var ptitle, ploc string
		var pprice int64
		var plisting string

		var bid string
		var bname, bphone string

		var sid string
		var sname, sphone string
		var scompany *string

		var cid *string
		var camt *int64
		var cstat *string
		var cdue *time.Time

		if err := rows.Scan(
			&id, &bc, &sc,
			&agreed,
			&bcat, &scAt, &completed,
			&created,
			&pid, &ptitle, &ploc, &pprice, &plisting,
			&bid, &bname, &bphone,
			&sid, &sname, &sphone, &scompany,
			&cid, &camt, &cstat, &cdue,
		); err != nil {
			break
		}

		var commission any
		if cid != nil && camt != nil && cstat != nil {
			dd := any(nil)
			if cdue != nil {
				dd = cdue.Format("2006-01-02")
			}
			commission = map[string]any{
				"id":                *cid,
				"transaction_id":    id,
				"commission_amount": *camt,
				"status":            *cstat,
				"due_date":          dd,
			}
		}

		items = append(items, map[string]any{
			"id":                  id,
			"buyer_confirmed":     bc,
			"seller_confirmed":    sc,
			"agreed_price":        agreed,
			"buyer_confirmed_at":  fmtRFC3339Ptr(bcat),
			"seller_confirmed_at": fmtRFC3339Ptr(scAt),
			"completed_at":        fmtRFC3339Ptr(completed),
			"created_at":          created.UTC().Format(time.RFC3339Nano),
			"property": map[string]any{
				"id": pid, "title": ptitle, "location": ploc,
				"price": pprice, "listing_type": plisting,
			},
			"buyer":      map[string]any{"id": bid, "name": bname, "phone": bphone},
			"seller":     map[string]any{"id": sid, "name": sname, "phone": sphone, "company_name": scompany},
			"commission": commission,
		})
	}

	path := strings.TrimSuffix(c.Request.URL.Path, "/")
	c.JSON(http.StatusOK, response.Paginator(path, page, perPage, total, items))
}

func fmtRFC3339Ptr(t *time.Time) any {
	if t == nil {
		return nil
	}
	return t.UTC().Format(time.RFC3339Nano)
}
