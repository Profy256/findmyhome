package api

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"findmyhome/backend/internal/vision"
)

func kycRequirements(role string) map[string]any {
	if role == "company" {
		return map[string]any{
			"required": map[string]string{
				"business_registration": "Certificate of Incorporation from Uganda Registration Services Bureau (URSB)",
			},
			"note": "Your business document must be verified before your company account is activated.",
			"benefits": []string{
				"Free Blue Badge for 30 days",
				"Online booking pre-approved",
				"2 free featured listing slots",
				"Reduced commission rate (3%)",
				"Land listings do not require title uploads",
			},
		}
	}
	return map[string]any{
		"required": map[string]string{
			"id_document": "National ID, Passport, or Driver's Licence",
		},
		"note": "Individual sellers must also upload a land title when listing land properties.",
	}
}

func (s *Server) kycStatus(c *gin.Context) {
	u, ok := UserFromContext(c.Request.Context())
	if !ok || u == nil {
		return
	}

	rows, err := s.Pool.Query(c.Request.Context(), `
		SELECT row_to_json(d)
		FROM kyc_documents d
		WHERE user_id=$1
		ORDER BY created_at DESC
	`, u.ID)
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not load documents.")
		return
	}
	defer rows.Close()

	docs := []any{}
	for rows.Next() {
		var raw []byte
		if err := rows.Scan(&raw); err != nil {
			break
		}
		var v any
		_ = json.Unmarshal(raw, &v)
		docs = append(docs, v)
	}

	c.JSON(http.StatusOK, map[string]any{
		"kyc_status":   u.KycStatus,
		"role":         u.Role,
		"documents":    docs,
		"requirements": kycRequirements(u.Role),
		"is_complete":  u.KycStatus == "verified",
		"can_list":     u.KycStatus == "verified",
	})
}

func (s *Server) kycUpload(c *gin.Context) {
	u, ok := UserFromContext(c.Request.Context())
	if !ok || u == nil {
		return
	}
	if u.Role == "buyer" {
		jsonErr(c, http.StatusUnprocessableEntity, "Buyers do not need KYC verification.")
		return
	}
	if u.KycStatus == "verified" {
		jsonErr(c, http.StatusUnprocessableEntity, "Your identity is already verified.")
		return
	}

	var body struct {
		DocumentType       string `json:"document_type"`
		FileURL            string `json:"file_url"`
		CloudinaryPublicID string `json:"cloudinary_public_id"`
	}
	if err := json.NewDecoder(c.Request.Body).Decode(&body); err != nil {
		jsonErr(c, http.StatusBadRequest, "Invalid JSON.")
		return
	}
	body.DocumentType = strings.TrimSpace(body.DocumentType)
	valid := map[string]bool{"national_id": true, "passport": true, "drivers_licence": true, "business_registration": true}
	if !valid[body.DocumentType] {
		writeValidation(c, "Validation failed.", map[string][]string{"document_type": {"invalid"}})
		return
	}
	if u.Role == "seller" && body.DocumentType == "business_registration" {
		writeValidation(c, "Validation failed.", map[string][]string{"document_type": {"Individual sellers cannot upload a business registration certificate."}})
		return
	}
	if strings.TrimSpace(body.FileURL) == "" || strings.TrimSpace(body.CloudinaryPublicID) == "" {
		writeValidation(c, "Validation failed.", map[string][]string{"file_url": {"required"}})
		return
	}

	var existingStatus *string
	_ = s.Pool.QueryRow(c.Request.Context(), `
		SELECT status::text FROM kyc_documents
		WHERE user_id=$1 AND document_type=$2 AND status IN ('pending','verified')
		ORDER BY created_at DESC
		LIMIT 1
	`, u.ID, body.DocumentType).Scan(&existingStatus)
	if existingStatus != nil {
		msg := "You already have a " + body.DocumentType + " document pending review."
		if *existingStatus == "verified" {
			msg = "You already have a " + body.DocumentType + " document that is verified."
		}
		c.JSON(http.StatusUnprocessableEntity, map[string]any{"message": msg, "status": *existingStatus})
		return
	}

	var did string
	err := s.Pool.QueryRow(c.Request.Context(), `
		INSERT INTO kyc_documents (user_id, document_type, file_url, cloudinary_public_id, status, created_at, updated_at)
		VALUES ($1,$2,$3,$4,'pending',NOW(),NOW())
		RETURNING id::text
	`, u.ID, body.DocumentType, strings.TrimSpace(body.FileURL), strings.TrimSpace(body.CloudinaryPublicID)).Scan(&did)
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not save document.")
		return
	}

	if u.KycStatus == "none" || u.KycStatus == "rejected" {
		_, _ = s.Pool.Exec(c.Request.Context(), `UPDATE users SET kyc_status='pending', updated_at=NOW() WHERE id=$1`, u.ID)
	}

	// Trigger Google Vision AI auto-verification in the background if configured.
	if s.Cfg.GoogleVisionAPIKey != "" {
		docID, _ := uuid.Parse(did)
		go s.autoVerifyKYC(docID, u.ID, body.DocumentType, strings.TrimSpace(body.FileURL))
	}

	next := "Your document will be automatically reviewed. Most verifications complete within a few minutes."
	if u.Role == "company" {
		next = "Your business document will be automatically reviewed. Activation takes just a few minutes."
	}

	c.JSON(http.StatusCreated, map[string]any{
		"message": "Document uploaded successfully. We are analysing it now. You will be notified once verification is complete.",
		"document": map[string]any{
			"id": did,
		},
		"what_happens_next": next,
	})
}

const autoApproveThreshold = 80

func (s *Server) autoVerifyKYC(docID, userID uuid.UUID, docType, imageURL string) {
	ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
	defer cancel()

	client := vision.New(s.Cfg.GoogleVisionAPIKey)
	score, err := client.AnalyzeDocument(ctx, imageURL, docType)
	if err != nil {
		slog.Warn("vision: analysis failed, leaving for admin review",
			slog.String("doc", docID.String()), slog.Any("err", err))
		return
	}

	_, _ = s.Pool.Exec(ctx,
		`UPDATE kyc_documents SET ai_confidence_score=$2, updated_at=NOW() WHERE id=$1`,
		docID, score)

	if score < autoApproveThreshold {
		slog.Info("vision: low confidence, pending admin review",
			slog.String("doc", docID.String()), slog.Int("score", score))
		return
	}

	// Auto-approve: update document and user status atomically.
	tx, err := s.Pool.Begin(ctx)
	if err != nil {
		return
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx,
		`UPDATE kyc_documents SET status='verified', reviewed_at=NOW(), updated_at=NOW()
		 WHERE id=$1 AND status='pending'`,
		docID)
	if err != nil || tag.RowsAffected() == 0 {
		return
	}
	_, _ = tx.Exec(ctx,
		`UPDATE users SET kyc_status='verified', updated_at=NOW() WHERE id=$1`,
		userID)
	_ = tx.Commit(ctx)

	slog.Info("vision: KYC auto-approved",
		slog.String("doc", docID.String()), slog.Int("score", score))
}

func (s *Server) kycDocuments(c *gin.Context) {
	u, ok := UserFromContext(c.Request.Context())
	if !ok || u == nil {
		return
	}
	rows, err := s.Pool.Query(c.Request.Context(), `
		SELECT id::text, document_type::text, status::text, rejection_reason,
		       ai_confidence_score, reviewed_at, created_at
		FROM kyc_documents
		WHERE user_id=$1
		ORDER BY created_at DESC
	`, u.ID)
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not load documents.")
		return
	}
	defer rows.Close()

	out := []map[string]any{}
	for rows.Next() {
		var id, dtype, status string
		var reason *string
		var ai *int32
		var reviewed *time.Time
		var created time.Time
		if err := rows.Scan(&id, &dtype, &status, &reason, &ai, &reviewed, &created); err != nil {
			break
		}
		var rev any
		if reviewed != nil {
			rev = reviewed.UTC().Format(time.RFC3339Nano)
		}
		out = append(out, map[string]any{
			"id": id, "document_type": dtype, "status": status,
			"rejection_reason": reason, "ai_confidence_score": ai,
			"reviewed_at": rev, "created_at": created.UTC().Format(time.RFC3339Nano),
		})
	}
	c.JSON(http.StatusOK, out)
}
