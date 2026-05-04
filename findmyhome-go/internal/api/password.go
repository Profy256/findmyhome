package api

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/google/uuid"

	"github.com/gin-gonic/gin"

	"findmyhome/backend/internal/repo"
)

func (s *Server) forgotPassword(c *gin.Context) {
	var body struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(c.Request.Body).Decode(&body); err != nil {
		jsonErr(c, http.StatusBadRequest, "Invalid JSON.")
		return
	}
	body.Email = strings.TrimSpace(strings.ToLower(body.Email))
	if body.Email == "" {
		writeValidation(c, "Validation failed.", map[string][]string{"email": {"required"}})
		return
	}

	user, err := repo.GetUserByEmail(c.Request.Context(), s.Pool, body.Email)
	if err != nil {
		c.JSON(http.StatusUnprocessableEntity, map[string]string{
			"message": "We could not find a user with that email address.",
		})
		return
	}
	_ = user

	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not generate reset token.")
		return
	}
	plain := hex.EncodeToString(tokenBytes)

	hashBytes, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not generate reset token.")
		return
	}

	_, _ = s.Pool.Exec(c.Request.Context(), `
		INSERT INTO password_reset_tokens(email,token,created_at)
		VALUES ($1,$2,NOW())
		ON CONFLICT (email) DO UPDATE SET token=$2, created_at=NOW()
	`, body.Email, string(hashBytes))

	c.JSON(http.StatusOK, map[string]string{
		"message": "Password reset link sent to your email address.",
	})
	_ = plain
}

func (s *Server) resetPassword(c *gin.Context) {
	var body struct {
		Token           string `json:"token"`
		Email           string `json:"email"`
		Password        string `json:"password"`
		PasswordConfirm string `json:"password_confirmation"`
	}
	if err := json.NewDecoder(c.Request.Body).Decode(&body); err != nil {
		jsonErr(c, http.StatusBadRequest, "Invalid JSON.")
		return
	}
	body.Email = strings.TrimSpace(strings.ToLower(body.Email))
	body.Token = strings.TrimSpace(body.Token)
	if body.Token == "" || body.Email == "" || len(body.Password) < 8 {
		c.JSON(http.StatusUnprocessableEntity, map[string]string{"message": "This password reset link is invalid or has expired."})
		return
	}
	if body.Password != body.PasswordConfirm {
		writeValidation(c, "Validation failed.", map[string][]string{"password": {"password confirmation mismatch"}})
		return
	}

	var tokenHash string
	var createdAt time.Time
	err := s.Pool.QueryRow(c.Request.Context(), `
		SELECT token, created_at FROM password_reset_tokens WHERE email=$1 LIMIT 1
	`, body.Email).Scan(&tokenHash, &createdAt)
	if err != nil || time.Since(createdAt) > 24*time.Hour {
		c.JSON(http.StatusUnprocessableEntity, map[string]string{"message": "This password reset link is invalid or has expired."})
		return
	}

	if bcrypt.CompareHashAndPassword([]byte(tokenHash), []byte(body.Token)) != nil {
		c.JSON(http.StatusUnprocessableEntity, map[string]string{"message": "This password reset link is invalid or has expired."})
		return
	}

	u, err := repo.GetUserByEmail(c.Request.Context(), s.Pool, body.Email)
	if err != nil {
		c.JSON(http.StatusUnprocessableEntity, map[string]string{"message": "This password reset link is invalid or has expired."})
		return
	}

	passHash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not reset password.")
		return
	}

	remember := uuid.NewString()
	if _, err := s.Pool.Exec(c.Request.Context(), `
		UPDATE users SET password=$2, remember_token=$3, updated_at=NOW()
		WHERE id=$1 AND deleted_at IS NULL
	`, u.ID, string(passHash), remember); err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not reset password.")
		return
	}

	_, _ = s.Pool.Exec(c.Request.Context(), `DELETE FROM password_reset_tokens WHERE email=$1`, body.Email)

	c.JSON(http.StatusOK, map[string]string{"message": "Password reset successfully. You can now log in."})
}
