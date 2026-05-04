package api

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/gin-gonic/gin"
	"net/http"
	"strconv"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"

	"findmyhome/backend/internal/auth"
	"findmyhome/backend/internal/repo"
	"findmyhome/backend/internal/seller"
)

type registerBody struct {
	Name               string   `json:"name"`
	Email              string   `json:"email"`
	Phone              string   `json:"phone"`
	Password           string   `json:"password"`
	Role               string   `json:"role"`
	TermsAgreed        any      `json:"terms_agreed"`
	CompanyName        *string  `json:"company_name"`
	RegistrationNumber *string  `json:"registration_number"`
	SellerCategories   []string `json:"seller_categories"`
	FileURL            *string  `json:"file_url"`
	CloudinaryPublicID *string  `json:"cloudinary_public_id"`
}

type loginBody struct {
	Email    string  `json:"email"`
	Password string  `json:"password"`
	FCMToken *string `json:"fcm_token"`
}

func (s *Server) register(c *gin.Context) {
	var body registerBody
	if err := json.NewDecoder(c.Request.Body).Decode(&body); err != nil {
		jsonErr(c, http.StatusBadRequest, "Invalid JSON.")
		return
	}
	body.Name = strings.TrimSpace(body.Name)
	body.Email = strings.TrimSpace(strings.ToLower(body.Email))
	body.Phone = strings.TrimSpace(body.Phone)

	errs := map[string][]string{}
	if body.Name == "" {
		errs["name"] = []string{"The name field is required."}
	}
	if body.Email == "" {
		errs["email"] = []string{"The email field is required."}
	}
	if body.Phone == "" {
		errs["phone"] = []string{"The phone field is required."}
	}
	if len(body.Password) < 8 {
		errs["password"] = []string{"The password must be at least 8 characters."}
	}
	switch body.Role {
	case "buyer", "seller", "company", "admin":
	default:
		errs["role"] = []string{"The selected role is invalid."}
	}
	if !termsAccepted(body.TermsAgreed) {
		errs["terms_agreed"] = []string{"You must agree to the terms."}
	}
	if body.Role == "company" && (body.CompanyName == nil || strings.TrimSpace(*body.CompanyName) == "") {
		errs["company_name"] = []string{"The company name field is required when role is company."}
	}
	if (body.Role == "seller" || body.Role == "company") && len(body.SellerCategories) == 0 {
		errs["seller_categories"] = []string{"At least one category is required for sellers."}
	}
	for _, cat := range body.SellerCategories {
		if !validSellerCategory(cat) {
			errs["seller_categories"] = append(errs["seller_categories"], "Invalid category "+cat)
			break
		}
	}
	if len(errs) > 0 {
		writeValidation(c, "Validation failed.", errs)
		return
	}

	if dupField := s.duplicateCredentials(c.Request.Context(), body.Email, body.Phone); dupField != "" {
		writeValidation(c, "Validation failed.", map[string][]string{
			dupField: {"The " + dupField + " has already been taken."},
		})
		return
	}

	passHash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not hash password.")
		return
	}

	var sellerCats any
	if body.Role == "seller" || body.Role == "company" {
		b, _ := json.Marshal(body.SellerCategories)
		sellerCats = b
	} else {
		sellerCats = nil
	}

	kycStart := body.Role == "seller" || body.Role == "company"
	var kycStatus string
	switch {
	case !kycStart:
		kycStatus = "none"
	case body.FileURL != nil && strings.TrimSpace(*body.FileURL) != "":
		kycStatus = "pending"
	default:
		kycStatus = "none"
	}

	var uid uuid.UUID
	err = s.Pool.QueryRow(c.Request.Context(), `
		INSERT INTO users (
		  name, email, phone, password, role,
		  seller_categories,
		  company_name, registration_number,
		  kyc_status, terms_agreed_at,
		  created_at, updated_at
		) VALUES (
		  $1, $2, $3, $4, $5,
		  $6::json,
		  $7, $8,
		  $9, NOW(),
		  NOW(), NOW()
		) RETURNING id
	`, body.Name, body.Email, body.Phone, string(passHash), body.Role,
		sellerCats, strPtr(body.CompanyName), strPtr(body.RegistrationNumber),
		kycStatus,
	).Scan(&uid)
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not create account: "+err.Error())
		return
	}

	if kycStart && body.FileURL != nil && strings.TrimSpace(*body.FileURL) != "" {
		docType := "national_id"
		if body.Role == "company" {
			docType = "business_registration"
		}
		publicID := ""
		if body.CloudinaryPublicID != nil {
			publicID = strings.TrimSpace(*body.CloudinaryPublicID)
		}
		_, _ = s.Pool.Exec(c.Request.Context(), `
			INSERT INTO kyc_documents (user_id, document_type, file_url, cloudinary_public_id, status, created_at, updated_at)
			VALUES ($1, $2, $3, $4, 'pending', NOW(), NOW())
		`, uid, docType, strings.TrimSpace(*body.FileURL), publicID)
	}

	u, err := repo.GetUser(c.Request.Context(), s.Pool, uid)
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "User created but could not load profile.")
		return
	}

	tok, err := auth.CreateToken(c.Request.Context(), s.Pool, u.ID)
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not issue token.")
		return
	}

	var kycInfo any
	cats, _ := u.SellerCategoriesSlice()
	if (u.Role == "seller" || u.Role == "company") && len(cats) > 0 {
		st := seller.StrictestCategory(cats)
		kycInfo = map[string]any{
			"threshold":          seller.KycThreshold(cats),
			"strictest_category": st,
			"message":            seller.KycMessage(st),
		}
	}

	var nextStep any
	if u.Role == "seller" || u.Role == "company" {
		nextStep = "Upload your identity document to get verified and start listing."
	}

	c.JSON(http.StatusCreated, map[string]any{
		"message":   "Account created successfully.",
		"user":      userPayload(c.Request.Context(), s.Pool, *u),
		"token":     tok,
		"kyc_info":  kycInfo,
		"next_step": nextStep,
	})
}

func (s *Server) login(c *gin.Context) {
	var body loginBody
	if err := json.NewDecoder(c.Request.Body).Decode(&body); err != nil {
		jsonErr(c, http.StatusBadRequest, "Invalid JSON.")
		return
	}
	body.Email = strings.TrimSpace(strings.ToLower(body.Email))
	if body.Email == "" || body.Password == "" {
		writeValidation(c, "Validation failed.", map[string][]string{
			"email": {"The provided credentials are incorrect."},
		})
		return
	}

	u, err := repo.GetUserByEmail(c.Request.Context(), s.Pool, body.Email)
	if err != nil {
		writeValidation(c, "Validation failed.", map[string][]string{
			"email": {"The provided credentials are incorrect."},
		})
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(body.Password)) != nil {
		writeValidation(c, "Validation failed.", map[string][]string{
			"email": {"The provided credentials are incorrect."},
		})
		return
	}

	if body.FCMToken != nil && strings.TrimSpace(*body.FCMToken) != "" {
		_, _ = s.Pool.Exec(c.Request.Context(), `UPDATE users SET fcm_token = $2, updated_at = NOW() WHERE id = $1`, u.ID, strings.TrimSpace(*body.FCMToken))
	}

	tok, err := auth.CreateToken(c.Request.Context(), s.Pool, u.ID)
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not issue token.")
		return
	}

	c.JSON(http.StatusOK, map[string]any{
		"message": "Login successful.",
		"user":    userPayload(c.Request.Context(), s.Pool, *u),
		"token":   tok,
	})
}

func (s *Server) logout(c *gin.Context) {
	hdr := c.GetHeader("Authorization")
	if strings.HasPrefix(strings.ToLower(hdr), "bearer ") {
		token := strings.TrimSpace(hdr[len("Bearer "):])
		_ = auth.DeleteCurrentToken(c.Request.Context(), s.Pool, token)
	}
	c.JSON(http.StatusOK, map[string]string{"message": "Logged out successfully."})
}

func (s *Server) me(c *gin.Context) {
	u, ok := UserFromContext(c.Request.Context())
	if !ok || u == nil {
		c.JSON(http.StatusUnauthorized, map[string]string{"message": "Unauthenticated."})
		return
	}
	c.JSON(http.StatusOK, userPayload(c.Request.Context(), s.Pool, *u))
}

func (s *Server) categories(c *gin.Context) {
	c.JSON(http.StatusOK, map[string]any{
		"categories": seller.RegistrationInfoMap(),
		"note":       "Select all categories you plan to list. Your KYC will be assessed at the strictest level you select.",
	})
}

func (s *Server) updateFCM(c *gin.Context) {
	var body struct {
		FCMToken string `json:"fcm_token"`
	}
	if err := json.NewDecoder(c.Request.Body).Decode(&body); err != nil || strings.TrimSpace(body.FCMToken) == "" {
		writeValidation(c, "Validation failed.", map[string][]string{"fcm_token": {"required"}})
		return
	}
	u, _ := UserFromContext(c.Request.Context())
	_, err := s.Pool.Exec(c.Request.Context(), `UPDATE users SET fcm_token = $2, updated_at = NOW() WHERE id = $1`, u.ID, strings.TrimSpace(body.FCMToken))
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not update token.")
		return
	}
	c.JSON(http.StatusOK, map[string]string{"message": "FCM token updated."})
}

func (s *Server) updateProfile(c *gin.Context) {
	u, ok := UserFromContext(c.Request.Context())
	if !ok || u == nil {
		return
	}

	var patch map[string]json.RawMessage
	if err := json.NewDecoder(c.Request.Body).Decode(&patch); err != nil {
		jsonErr(c, http.StatusBadRequest, "Invalid JSON.")
		return
	}

	setParts := []string{}
	args := []any{}
	idx := 1

	if raw, ok := patch["name"]; ok {
		var v string
		_ = json.Unmarshal(raw, &v)
		v = strings.TrimSpace(v)
		if v != "" {
			setParts = append(setParts, `name = $`+strconv.Itoa(idx))
			args = append(args, v)
			idx++
		}
	}

	if raw, ok := patch["phone"]; ok {
		var v string
		_ = json.Unmarshal(raw, &v)
		v = strings.TrimSpace(v)
		if v == "" {
			writeValidation(c, "Validation failed.", map[string][]string{"phone": {"invalid"}})
			return
		}
		var other uuid.UUID
		err := s.Pool.QueryRow(c.Request.Context(), `SELECT id FROM users WHERE phone = $1 AND id <> $2 AND deleted_at IS NULL LIMIT 1`, v, u.ID).Scan(&other)
		if err == nil {
			writeValidation(c, "Validation failed.", map[string][]string{"phone": {"The phone has already been taken."}})
			return
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			jsonErr(c, http.StatusInternalServerError, "Database error.")
			return
		}
		setParts = append(setParts, `phone = $`+strconv.Itoa(idx))
		args = append(args, v)
		idx++
	}

	if raw, ok := patch["company_name"]; ok {
		var v *string
		_ = json.Unmarshal(raw, &v)
		setParts = append(setParts, `company_name = $`+strconv.Itoa(idx))
		args = append(args, strPtr(v))
		idx++
	}

	if raw, ok := patch["seller_categories"]; ok {
		var cats []string
		_ = json.Unmarshal(raw, &cats)
		for _, cat := range cats {
			if !validSellerCategory(cat) {
				writeValidation(c, "Validation failed.", map[string][]string{"seller_categories": {"invalid"}})
				return
			}
		}
		j, _ := json.Marshal(cats)
		setParts = append(setParts, `seller_categories = $`+strconv.Itoa(idx)+`::json`)
		args = append(args, j)
		idx++
	}

	if len(setParts) == 0 {
		c.JSON(http.StatusOK, map[string]any{"message": "Profile updated.", "user": userPayload(c.Request.Context(), s.Pool, *u)})
		return
	}

	setParts = append(setParts, `updated_at = NOW()`)
	args = append(args, u.ID)

	q := `UPDATE users SET ` + strings.Join(setParts, ", ") + ` WHERE id = $` + strconv.Itoa(idx) + ` AND deleted_at IS NULL`
	cmd, err := s.Pool.Exec(c.Request.Context(), q, args...)
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not update profile.")
		return
	}
	if cmd.RowsAffected() == 0 {
		jsonErr(c, http.StatusNotFound, "User not found.")
		return
	}

	fresh, err := repo.GetUser(c.Request.Context(), s.Pool, u.ID)
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Updated but could not load user.")
		return
	}

	c.JSON(http.StatusOK, map[string]any{
		"message": "Profile updated.",
		"user":    userPayload(c.Request.Context(), s.Pool, *fresh),
	})
}

func strPtr(p *string) any {
	if p == nil || strings.TrimSpace(*p) == "" {
		return nil
	}
	return strings.TrimSpace(*p)
}

func termsAccepted(v any) bool {
	switch t := v.(type) {
	case bool:
		return t
	case float64:
		return t != 0
	case string:
		s := strings.TrimSpace(t)
		return strings.EqualFold(s, "true") || s == "1" || strings.EqualFold(s, "on") || strings.EqualFold(s, "yes")
	default:
		return false
	}
}

func validSellerCategory(c string) bool {
	switch c {
	case "land", "apartment", "house", "rental", "airbnb", "lodge":
		return true
	default:
		return false
	}
}

func (s *Server) duplicateCredentials(ctx context.Context, email, phone string) string {
	var id uuid.UUID
	if err := s.Pool.QueryRow(ctx, `SELECT id FROM users WHERE lower(email)=lower($1) AND deleted_at IS NULL LIMIT 1`, email).Scan(&id); err == nil {
		return "email"
	}
	if err := s.Pool.QueryRow(ctx, `SELECT id FROM users WHERE phone=$1 AND deleted_at IS NULL LIMIT 1`, phone).Scan(&id); err == nil {
		return "phone"
	}
	return ""
}
