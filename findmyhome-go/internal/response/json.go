package response

import (
	"encoding/json"
	"net/http"
)

func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func ValidationError(w http.ResponseWriter, message string, errs map[string][]string) {
	JSON(w, http.StatusUnprocessableEntity, map[string]any{
		"message": message,
		"errors":  errs,
	})
}

func Message(w http.ResponseWriter, status int, message string) {
	JSON(w, status, map[string]string{"message": message})
}

// Laravel-style paginator for resource collections.
func Paginator(path string, page, perPage int, total int64, data any) map[string]any {
	if page < 1 {
		page = 1
	}
	last := int((total + int64(perPage) - 1) / int64(perPage))
	if last == 0 {
		last = 1
	}
	from := int64(0)
	if total > 0 {
		from = int64((page-1)*perPage) + 1
	}
	to := int64(page * perPage)
	if to > total {
		to = total
	}

	var next, prev any
	if page < last {
		next = fmtPageURL(path, page+1)
	} else {
		next = nil
	}
	if page > 1 {
		prev = fmtPageURL(path, page-1)
	} else {
		prev = nil
	}

	return map[string]any{
		"current_page":   page,
		"data":           data,
		"first_page_url": appendQuery(path, 1),
		"from":           from,
		"last_page":      last,
		"last_page_url":  appendQuery(path, last),
		"next_page_url":  next,
		"path":           path,
		"per_page":       perPage,
		"prev_page_url":  prev,
		"to":             to,
		"total":          total,
	}
}

func fmtPageURL(path string, page int) string {
	return appendQuery(path, page)
}

func appendQuery(path string, page int) string {
	return path + "?page=" + itoa(page)
}

func itoa(i int) string {
	if i == 0 {
		return "0"
	}
	var b [16]byte
	pos := len(b)
	for i > 0 {
		pos--
		b[pos] = byte('0' + i%10)
		i /= 10
	}
	return string(b[pos:])
}
