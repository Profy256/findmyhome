package api

import (
	"encoding/json"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"net/http"
	"strings"
	"time"

	"findmyhome/backend/internal/response"
)

const userMorph = `App\Models\User`

func (s *Server) notificationsIndex(c *gin.Context) {
	me, ok := UserFromContext(c.Request.Context())
	if !ok || me == nil {
		return
	}

	var unread int64
	_ = s.Pool.QueryRow(c.Request.Context(), `
		SELECT COUNT(*) FROM notifications
		WHERE notifiable_type=$1 AND notifiable_id=$2 AND read_at IS NULL
	`, userMorph, me.ID).Scan(&unread)

	page := parsePageReq(c.Request)
	perPage := 20
	offset := (page - 1) * perPage

	var total int64
	_ = s.Pool.QueryRow(c.Request.Context(), `
		SELECT COUNT(*) FROM notifications WHERE notifiable_type=$1 AND notifiable_id=$2
	`, userMorph, me.ID).Scan(&total)

	rows, err := s.Pool.Query(c.Request.Context(), `
		SELECT id::text, type, data::text, read_at, created_at, updated_at
		FROM notifications
		WHERE notifiable_type=$1 AND notifiable_id=$2
		ORDER BY created_at DESC
		LIMIT $3 OFFSET $4
	`, userMorph, me.ID, perPage, offset)
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not load notifications.")
		return
	}
	defer rows.Close()

	items := []map[string]any{}
	for rows.Next() {
		var id, typ, raw string
		var readAt *time.Time
		var created, updated time.Time
		if err := rows.Scan(&id, &typ, &raw, &readAt, &created, &updated); err != nil {
			break
		}
		var payload any
		_ = json.Unmarshal([]byte(raw), &payload)
		items = append(items, map[string]any{
			"id":         id,
			"type":       typ,
			"data":       payload,
			"read_at":    timePtrRFCNotif(readAt),
			"created_at": created.UTC().Format(time.RFC3339Nano),
			"updated_at": updated.UTC().Format(time.RFC3339Nano),
		})
	}

	path := strings.TrimSuffix(c.Request.URL.Path, "/")
	c.JSON(http.StatusOK, map[string]any{
		"unread_count":  unread,
		"notifications": response.Paginator(path, page, perPage, total, items),
	})
}

func timePtrRFCNotif(t *time.Time) any {
	if t == nil {
		return nil
	}
	return t.UTC().Format(time.RFC3339Nano)
}

func (s *Server) notificationsUnread(c *gin.Context) {
	me, ok := UserFromContext(c.Request.Context())
	if !ok || me == nil {
		return
	}

	var unread int64
	_ = s.Pool.QueryRow(c.Request.Context(), `
		SELECT COUNT(*) FROM notifications
		WHERE notifiable_type=$1 AND notifiable_id=$2 AND read_at IS NULL
	`, userMorph, me.ID).Scan(&unread)

	rows, err := s.Pool.Query(c.Request.Context(), `
		SELECT id::text, type, data::text, read_at, created_at, updated_at
		FROM notifications
		WHERE notifiable_type=$1 AND notifiable_id=$2 AND read_at IS NULL
		ORDER BY created_at DESC
	`, userMorph, me.ID)
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not load notifications.")
		return
	}
	defer rows.Close()

	items := []map[string]any{}
	for rows.Next() {
		var id, typ, raw string
		var readAt *time.Time
		var created, updated time.Time
		if err := rows.Scan(&id, &typ, &raw, &readAt, &created, &updated); err != nil {
			break
		}
		var payload any
		_ = json.Unmarshal([]byte(raw), &payload)
		items = append(items, map[string]any{
			"id":         id,
			"type":       typ,
			"data":       payload,
			"read_at":    nil,
			"created_at": created.UTC().Format(time.RFC3339Nano),
			"updated_at": updated.UTC().Format(time.RFC3339Nano),
		})
	}

	c.JSON(http.StatusOK, map[string]any{"count": unread, "notifications": items})
}

func (s *Server) notificationsMarkRead(c *gin.Context) {
	me, ok := UserFromContext(c.Request.Context())
	if !ok || me == nil {
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}
	cmd, err := s.Pool.Exec(c.Request.Context(), `
		UPDATE notifications SET read_at=NOW(), updated_at=NOW()
		WHERE id=$1 AND notifiable_type=$2 AND notifiable_id=$3
	`, id, userMorph, me.ID)
	if err != nil || cmd.RowsAffected() == 0 {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}
	c.JSON(http.StatusOK, map[string]string{"message": "Notification marked as read."})
}

func (s *Server) notificationsMarkAllRead(c *gin.Context) {
	me, ok := UserFromContext(c.Request.Context())
	if !ok || me == nil {
		return
	}
	_, _ = s.Pool.Exec(c.Request.Context(), `
		UPDATE notifications SET read_at=NOW(), updated_at=NOW()
		WHERE notifiable_type=$1 AND notifiable_id=$2 AND read_at IS NULL
	`, userMorph, me.ID)
	c.JSON(http.StatusOK, map[string]string{"message": "All notifications marked as read."})
}

func (s *Server) notificationsDelete(c *gin.Context) {
	me, ok := UserFromContext(c.Request.Context())
	if !ok || me == nil {
		return
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}
	cmd, err := s.Pool.Exec(c.Request.Context(), `
		DELETE FROM notifications WHERE id=$1 AND notifiable_type=$2 AND notifiable_id=$3
	`, id, userMorph, me.ID)
	if err != nil || cmd.RowsAffected() == 0 {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}
	c.JSON(http.StatusOK, map[string]string{"message": "Notification deleted."})
}
