package api

import (
	"encoding/json"
	"strconv"
	"strings"
)

func strField(body map[string]json.RawMessage, key string) string {
	raw, ok := body[key]
	if !ok {
		return ""
	}
	var s string
	_ = json.Unmarshal(raw, &s)
	return strings.TrimSpace(s)
}

func strFieldPtr(body map[string]json.RawMessage, key string) *string {
	s := strField(body, key)
	if s == "" {
		return nil
	}
	return &s
}

func intField(body map[string]json.RawMessage, key string) int64 {
	raw, ok := body[key]
	if !ok {
		return 0
	}
	var f float64
	if err := json.Unmarshal(raw, &f); err == nil {
		return int64(f)
	}
	var i int64
	if err := json.Unmarshal(raw, &i); err == nil {
		return i
	}
	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		return 0
	}
	v, err := strconv.ParseInt(strings.TrimSpace(s), 10, 64)
	if err != nil {
		return 0
	}
	return v
}

func intPtrField(body map[string]json.RawMessage, key string) *int32 {
	raw, ok := body[key]
	if !ok {
		return nil
	}
	var anyv any
	if err := json.Unmarshal(raw, &anyv); err != nil || anyv == nil {
		return nil
	}
	switch t := anyv.(type) {
	case float64:
		v := int32(t)
		return &v
	default:
		v := intField(body, key)
		i32 := int32(v)
		return &i32
	}
}

func floatPtrField(body map[string]json.RawMessage, key string) *float64 {
	raw, ok := body[key]
	if !ok {
		return nil
	}
	var x *float64
	if err := json.Unmarshal(raw, &x); err == nil {
		return x
	}
	var f float64
	if err := json.Unmarshal(raw, &f); err == nil {
		return &f
	}
	return nil
}

func strSliceField(body map[string]json.RawMessage, key string) []string {
	raw, ok := body[key]
	if !ok {
		return nil
	}
	var arr []string
	if json.Unmarshal(raw, &arr) == nil {
		return arr
	}
	return nil
}
