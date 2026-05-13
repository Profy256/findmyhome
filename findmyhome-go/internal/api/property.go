package api

import (
	"bytes"
	"encoding/json"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"net/http"
	"strconv"
	"strings"
	"time"

	"findmyhome/backend/internal/model"
	"log/slog"

	"findmyhome/backend/internal/response"
	"findmyhome/backend/internal/seller"
)

func (s *Server) propertiesIndex(c *gin.Context) {
	q := c.Request.URL.Query()
	page := parsePageReq(c.Request)
	perPage := 20

	where := []string{"p.status = 'active'", "p.deleted_at IS NULL", "u.deleted_at IS NULL"}
	args := []any{}
	n := 1

	if loc := strings.TrimSpace(q.Get("location")); loc != "" {
		where = append(where, `(p.location ILIKE $`+strconv.Itoa(n)+` OR p.district ILIKE $`+strconv.Itoa(n)+`)`)
		args = append(args, "%"+loc+"%")
		n++
	}
	if typ := strings.TrimSpace(q.Get("type")); typ != "" {
		where = append(where, `p.property_type::text = $`+strconv.Itoa(n))
		args = append(args, typ)
		n++
	}
	if listing := strings.TrimSpace(q.Get("listing")); listing != "" {
		where = append(where, `p.listing_type::text = $`+strconv.Itoa(n))
		args = append(args, listing)
		n++
	}
	if minBeds := strings.TrimSpace(q.Get("bedrooms")); minBeds != "" {
		m, _ := strconv.Atoi(minBeds)
		if m > 0 {
			where = append(where, `p.bedrooms >= $`+strconv.Itoa(n))
			args = append(args, m)
			n++
		}
	}

	if strings.TrimSpace(q.Get("listing")) == "rent" && strings.TrimSpace(q.Get("max_price")) != "" {
		mx, _ := strconv.ParseInt(strings.TrimSpace(q.Get("max_price")), 10, 64)
		if mx > 0 {
			where = append(where, `p.price <= $`+strconv.Itoa(n))
			args = append(args, mx)
			n++
		}
	} else {
		if mn := strings.TrimSpace(q.Get("min_price")); mn != "" {
			v, _ := strconv.ParseInt(mn, 10, 64)
			if v > 0 {
				where = append(where, `p.price >= $`+strconv.Itoa(n))
				args = append(args, v)
				n++
			}
		}
		if mx := strings.TrimSpace(q.Get("max_price")); mx != "" {
			v, _ := strconv.ParseInt(mx, 10, 64)
			if v > 0 {
				where = append(where, `p.price <= $`+strconv.Itoa(n))
				args = append(args, v)
				n++
			}
		}
	}

	if strings.EqualFold(strings.TrimSpace(q.Get("blue_badge_only")), "true") || q.Get("blue_badge_only") == "1" {
		where = append(where, `u.blue_badge = TRUE`)
	}

	whereSQL := strings.Join(where, " AND ")

	var total int64
	countQ := `SELECT COUNT(*) FROM properties p JOIN users u ON u.id = p.seller_id WHERE ` + whereSQL
	if err := s.Pool.QueryRow(c.Request.Context(), countQ, args...).Scan(&total); err != nil {
		jsonErr(c, http.StatusInternalServerError, "Search failed.")
		return
	}

	offset := (page - 1) * perPage
	argsWithPage := append(append([]any{}, args...), perPage, offset)

	limitPos := strconv.Itoa(n)
	offsetPos := strconv.Itoa(n + 1)

	dataQ := `
		SELECT ` + strings.Join(propertySelectCols(), ", ") + `
		FROM properties p
		JOIN users u ON u.id = p.seller_id
		WHERE ` + whereSQL + `
		ORDER BY CASE WHEN u.role::text = 'company' THEN 0 ELSE 1 END,
		         u.blue_badge DESC,
		         p.featured DESC,
		         p.created_at DESC
		LIMIT $` + limitPos + ` OFFSET $` + offsetPos

	rows, err := s.Pool.Query(c.Request.Context(), dataQ, argsWithPage...)
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Search failed.")
		return
	}
	defer rows.Close()

	out := []map[string]any{}
	for rows.Next() {
		m, _, err := scanPropertyWithSeller(rows)
		if err != nil {
			jsonErr(c, http.StatusInternalServerError, "Search failed.")
			return
		}
		out = append(out, m)
	}

	path := strings.TrimSuffix(c.Request.URL.Path, "/")
	c.Header("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
	c.JSON(http.StatusOK, response.Paginator(path, page, perPage, total, out))
}

func propertySelectCols() []string {
	return []string{
		"p.id", "p.seller_id", "p.title", "p.description", "p.price", "p.location", "p.district",
		"p.property_type::text", "p.listing_type::text",
		"p.bedrooms", "p.bathrooms", "p.size", "p.photos", "p.amenities",
		"p.max_guests", "p.price_per_night", "p.price_period",
		"p.status::text", "p.featured", "p.featured_until",
		"p.land_title_url", "p.land_title_cloudinary_id", "p.land_title_lat", "p.land_title_lng", "p.land_title_verified",
		"p.created_at", "p.updated_at",
		"u.id", "u.name", "u.role::text", "u.blue_badge", "u.blue_badge_expires_at", "u.kyc_status::text", "u.company_name",
		"u.booking_enabled", "u.seller_categories",
	}
}

func (s *Server) propertyShow(c *gin.Context) {
	id, err := uuid.Parse(c.Param("property"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}

	q := `SELECT ` + strings.Join(propertySelectCols(), ", ") + `
		FROM properties p
		JOIN users u ON u.id = p.seller_id
		WHERE p.id = $1 AND p.deleted_at IS NULL AND u.deleted_at IS NULL`

	row := s.Pool.QueryRow(c.Request.Context(), q, id)
	propMap, su, err := scanPropertyWithSeller(row)
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}

	avg, total := ratingStats(c.Request.Context(), s.Pool, su.ID)

	c.JSON(http.StatusOK, map[string]any{
		"property":         propMap,
		"trust_label":      trustLabel(propMap["property_type"].(string), su.Role, propMap["land_title_url"]),
		"has_map_location": propMap["land_title_lat"] != nil && propMap["land_title_lng"] != nil,
		"google_maps_url":  googleMapsURL(propMap),
		"seller_rating":    avg,
		"seller_reviews":   total,
		"category_info":    categoryInfo(propMap["property_type"].(string)),
	})
}

func googleMapsURL(property map[string]any) any {
	lat := property["land_title_lat"]
	lng := property["land_title_lng"]
	if lat == nil || lng == nil {
		return nil
	}
	latStr := formatCoord(lat)
	lngStr := formatCoord(lng)
	if latStr == "" || lngStr == "" {
		return nil
	}
	return "https://maps.google.com/?q=" + latStr + "," + lngStr
}

func formatCoord(v any) string {
	switch t := v.(type) {
	case float64:
		return strconv.FormatFloat(t, 'f', 7, 64)
	case string:
		return t
	default:
		return ""
	}
}

func trustLabel(propertyType, sellerRole string, landTitle any) string {
	if sellerRole == "company" {
		return "Registered Business ✓"
	}
	if propertyType == "land" {
		switch t := landTitle.(type) {
		case string:
			if strings.TrimSpace(t) != "" {
				return "Land Title Uploaded ✓"
			}
		case *string:
			if t != nil && strings.TrimSpace(*t) != "" {
				return "Land Title Uploaded ✓"
			}
		}
	}
	return "Identity Verified ✓"
}

func categoryInfo(propertyType string) map[string]any {
	cat := seller.PropertyTypeToCategory[propertyType]
	if cat == "" {
		return map[string]any{}
	}
	return map[string]any{
		"category":         cat,
		"label":            seller.Labels[cat],
		"strictness_label": seller.StrictnessLabels[cat],
	}
}

func scanPropertyWithSeller(row pgx.Row) (map[string]any, *model.User, error) {
	var (
		pid, pseller uuid.UUID
		title, desc  string
		price        int64
		location     string
		district     *string
		ptype, ltype string
		bed, bath    *int32
		size         *string
		photos, am   []byte
		maxGuests    *int32
		ppn          *float64
		pricePeriod  *string
		status       string
		featured     bool
		featUntil    *time.Time
		landURL      *string
		landCID      *string
		landLat      *float64
		landLng      *float64
		landVer      bool
		pCreated     time.Time
		pUpdated     time.Time

		sid        uuid.UUID
		sname      string
		srole      string
		sblue      bool
		sblueExp   *time.Time
		skyc       string
		scompany   *string
		sbooking   bool
		sellerCats []byte
	)

	if err := row.Scan(
		&pid, &pseller,
		&title, &desc, &price, &location, &district,
		&ptype, &ltype,
		&bed, &bath, &size, &photos, &am,
		&maxGuests, &ppn, &pricePeriod,
		&status, &featured, &featUntil,
		&landURL, &landCID, &landLat, &landLng, &landVer,
		&pCreated, &pUpdated,
		&sid, &sname, &srole, &sblue, &sblueExp, &skyc, &scompany, &sbooking, &sellerCats,
	); err != nil {
		return nil, nil, err
	}

	su := &model.User{
		ID:                 sid,
		Name:               sname,
		Role:               srole,
		KycStatus:          skyc,
		BlueBadge:          sblue,
		BlueBadgeExpiresAt: sblueExp,
		CompanyName:        scompany,
		BookingEnabled:     sbooking,
		SellerCategories:   sellerCats,
	}

	prop := map[string]any{
		"id":                       pid.String(),
		"seller_id":                pseller.String(),
		"title":                    title,
		"description":              desc,
		"price":                    price,
		"location":                 location,
		"district":                 district,
		"property_type":            ptype,
		"listing_type":             ltype,
		"bedrooms":                 optionalInt(bed),
		"bathrooms":                optionalInt(bath),
		"size":                     size,
		"photos":                   decodeJSONArray(photos),
		"amenities":                decodeJSONArray(am),
		"max_guests":               optionalInt(maxGuests),
		"price_per_night":          ppn,
		"price_period":             pricePeriod,
		"status":                   status,
		"featured":                 featured,
		"featured_until":           timePtrRFC3339(featUntil),
		"land_title_url":           landURL,
		"land_title_cloudinary_id": landCID,
		"land_title_lat":           landLat,
		"land_title_lng":           landLng,
		"land_title_verified":      landVer,
		"created_at":               pCreated.UTC().Format(time.RFC3339Nano),
		"updated_at":               pUpdated.UTC().Format(time.RFC3339Nano),
		"seller":                   publicSeller(su),
	}
	return prop, su, nil
}

func optionalInt(v *int32) any {
	if v == nil {
		return nil
	}
	return int(*v)
}

func timePtrRFC3339(t *time.Time) any {
	if t == nil {
		return nil
	}
	return t.UTC().Format(time.RFC3339Nano)
}

func decodeJSONArray(b []byte) any {
	if len(bytes.TrimSpace(b)) == 0 {
		return nil
	}
	var v any
	if err := json.Unmarshal(b, &v); err != nil {
		return nil
	}
	return v
}

func publicSeller(u *model.User) map[string]any {
	cats, _ := u.SellerCategoriesSlice()
	if cats == nil {
		cats = []string{}
	}
	return map[string]any{
		"id":                    u.ID.String(),
		"name":                  u.Name,
		"role":                  u.Role,
		"blue_badge":            model.HasBlueBadge(*u, time.Now()),
		"blue_badge_expires_at": timePtrRFC3339(u.BlueBadgeExpiresAt),
		"kyc_status":            u.KycStatus,
		"company_name":          u.CompanyName,
		"booking_enabled":       u.BookingEnabled,
		"seller_categories":     cats,
	}
}

func (s *Server) propertyStore(c *gin.Context) {
	me, _ := UserFromContext(c.Request.Context())
	if me.KycStatus != "verified" {
		c.JSON(http.StatusForbidden, map[string]any{
			"message":    "You must complete identity verification before listing a property.",
			"kyc_status": me.KycStatus,
			"action":     "Upload your documents in the KYC section of your dashboard.",
		})
		return
	}
	if me.Role != "seller" && me.Role != "company" && me.Role != "admin" {
		c.JSON(http.StatusForbidden, map[string]string{"message": "Only seller or company accounts can list properties."})
		return
	}

	var body map[string]json.RawMessage
	if err := json.NewDecoder(c.Request.Body).Decode(&body); err != nil {
		jsonErr(c, http.StatusBadRequest, "Invalid JSON.")
		return
	}

	title := strField(body, "title")
	desc := strField(body, "description")
	price := intField(body, "price")
	location := strField(body, "location")
	district := strFieldPtr(body, "district")
	ptype := strField(body, "property_type")

	errs := map[string][]string{}
	if title == "" {
		errs["title"] = []string{"required"}
	}
	if desc == "" {
		errs["description"] = []string{"required"}
	}
	if price <= 0 {
		errs["price"] = []string{"required"}
	}
	if location == "" {
		errs["location"] = []string{"required"}
	}
	validType := map[string]bool{"land": true, "apartment": true, "rental": true, "house": true, "airbnb": true, "lodge": true}
	if !validType[ptype] {
		errs["property_type"] = []string{"invalid"}
	}
	photos := strSliceField(body, "photos")
	if len(photos) < 1 {
		errs["photos"] = []string{"You must upload at least one photo."}
	}
	landTitleURL := strFieldPtr(body, "land_title_url")
	if seller.RequiresLandTitle(ptype, me.Role) {
		if landTitleURL == nil || strings.TrimSpace(*landTitleURL) == "" {
			errs["land_title_url"] = []string{"Land title is required for land listings."}
		}
	}
	if len(errs) > 0 {
		writeValidation(c, "Validation failed.", errs)
		return
	}

	cats, err := me.SellerCategoriesSlice()
	if err != nil {
		cats = []string{}
	}
	if !seller.CanListType(cats, ptype, me.Role) {
		req := seller.PropertyTypeToCategory[ptype]
		c.JSON(http.StatusForbidden, map[string]any{
			"message":           "You are not registered to list this category of property.",
			"required_category": req,
			"your_categories":   cats,
		})
		return
	}

	listing := seller.ListingTypeForPropertyType(ptype)

	photosJSON, _ := json.Marshal(photos)
	amJSON := json.RawMessage(`null`)
	if raw, ok := body["amenities"]; ok {
		amJSON = raw
	}

	bed := intPtrField(body, "bedrooms")
	bath := intPtrField(body, "bathrooms")
	sizePtr := strFieldPtr(body, "size")
	maxGuestsPtr := intPtrField(body, "max_guests")
	pricePeriodPtr := strFieldPtr(body, "price_period")
	landCID := strFieldPtr(body, "land_title_cloudinary_id")
	landLat := floatPtrField(body, "land_title_lat")
	landLng := floatPtrField(body, "land_title_lng")

	landTitleForDB := interface{}(landTitleURL)
	landCIDForDB := interface{}(landCID)
	if me.Role == "company" {
		landTitleForDB = nil
		landCIDForDB = nil
	}

	var pid uuid.UUID
	err = s.Pool.QueryRow(c.Request.Context(), `
		INSERT INTO properties (
		  seller_id, title, description, price, price_period, location, district,
		  property_type, listing_type,
		  bedrooms, bathrooms, size, photos, amenities,
		  max_guests,
		  land_title_url, land_title_cloudinary_id, land_title_lat, land_title_lng,
		  status,
		  created_at, updated_at
		) VALUES (
		  $1,$2,$3,$4,$5,$6,$7,
		  $8,$9,
		  $10,$11,$12,$13::jsonb,$14::jsonb,
		  $15,
		  $16,$17,$18,$19,
		  'active',
		  NOW(), NOW()
		) RETURNING id
	`, me.ID, title, desc, price, pricePeriodPtr, location, districtNullable(district),
		ptype, listing,
		bed, bath, sizePtr, photosJSON, []byte(amJSON),
		maxGuestsPtr,
		landTitleForDB, landCIDForDB, landLat, landLng,
	).Scan(&pid)

	if err != nil {
		slog.Error("propertyStore: INSERT failed",
			slog.String("seller_id", me.ID.String()),
			slog.String("property_type", ptype),
			slog.Any("err", err),
		)
		jsonErr(c, http.StatusInternalServerError, "Could not create listing.")
		return
	}

	row := s.Pool.QueryRow(c.Request.Context(), `SELECT `+strings.Join(propertySelectCols(), ",")+`
		FROM properties p JOIN users u ON u.id = p.seller_id WHERE p.id = $1`, pid)
	propMap, _, err := scanPropertyWithSeller(row)
	if err != nil {
		c.JSON(http.StatusCreated, map[string]any{
			"message": "Property listed successfully.",
		})
		return
	}

	c.JSON(http.StatusCreated, map[string]any{
		"message":  "Property listed successfully.",
		"property": propMap,
	})
}

func districtNullable(p *string) any {
	if p == nil || strings.TrimSpace(*p) == "" {
		return nil
	}
	return strings.TrimSpace(*p)
}

func (s *Server) propertyUpdate(c *gin.Context) {
	me, _ := UserFromContext(c.Request.Context())
	id, err := uuid.Parse(c.Param("property"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}

	var seller uuid.UUID
	var status string
	err = s.Pool.QueryRow(c.Request.Context(), `SELECT seller_id, status::text FROM properties WHERE id = $1 AND deleted_at IS NULL`, id).
		Scan(&seller, &status)
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}
	if seller != me.ID {
		jsonErr(c, http.StatusForbidden, "Unauthorized.")
		return
	}
	if status == "sold" || status == "rented" {
		jsonErr(c, http.StatusUnprocessableEntity, "Cannot edit a sold or rented listing.")
		return
	}

	var body map[string]json.RawMessage
	if err := json.NewDecoder(c.Request.Body).Decode(&body); err != nil {
		jsonErr(c, http.StatusBadRequest, "Invalid JSON.")
		return
	}

	fields := []string{}
	args := []any{}
	idx := 1

	if raw, ok := body["title"]; ok {
		var v string
		_ = json.Unmarshal(raw, &v)
		if strings.TrimSpace(v) != "" {
			fields = append(fields, `title = $`+strconv.Itoa(idx))
			args = append(args, strings.TrimSpace(v))
			idx++
		}
	}
	if raw, ok := body["description"]; ok {
		var v string
		_ = json.Unmarshal(raw, &v)
		if strings.TrimSpace(v) != "" {
			fields = append(fields, `description = $`+strconv.Itoa(idx))
			args = append(args, strings.TrimSpace(v))
			idx++
		}
	}
	if raw, ok := body["price"]; ok {
		var v int64
		_ = json.Unmarshal(raw, &v)
		if v < 1 {
			var f float64
			_ = json.Unmarshal(raw, &f)
			v = int64(f)
		}
		if v >= 1 {
			fields = append(fields, `price = $`+strconv.Itoa(idx))
			args = append(args, v)
			idx++
		}
	}
	if raw, ok := body["location"]; ok {
		var v string
		_ = json.Unmarshal(raw, &v)
		if strings.TrimSpace(v) != "" {
			fields = append(fields, `location = $`+strconv.Itoa(idx))
			args = append(args, strings.TrimSpace(v))
			idx++
		}
	}
	if raw, ok := body["district"]; ok {
		var v *string
		_ = json.Unmarshal(raw, &v)
		fields = append(fields, `district = $`+strconv.Itoa(idx))
		args = append(args, districtNullable(v))
		idx++
	}
	if raw, ok := body["bedrooms"]; ok {
		if v := intPtrField(map[string]json.RawMessage{"x": raw}, "x"); v != nil {
			fields = append(fields, `bedrooms = $`+strconv.Itoa(idx))
			args = append(args, *v)
			idx++
		}
	}
	if raw, ok := body["bathrooms"]; ok {
		if v := intPtrField(map[string]json.RawMessage{"x": raw}, "x"); v != nil {
			fields = append(fields, `bathrooms = $`+strconv.Itoa(idx))
			args = append(args, *v)
			idx++
		}
	}
	if raw, ok := body["size"]; ok {
		var v *string
		_ = json.Unmarshal(raw, &v)
		fields = append(fields, `size = $`+strconv.Itoa(idx))
		args = append(args, strPtrOrNil(v))
		idx++
	}
	if raw, ok := body["price_period"]; ok {
		var v *string
		_ = json.Unmarshal(raw, &v)
		fields = append(fields, `price_period = $`+strconv.Itoa(idx))
		args = append(args, strPtrOrNil(v))
		idx++
	}
	if raw, ok := body["max_guests"]; ok {
		if v := intPtrField(map[string]json.RawMessage{"x": raw}, "x"); v != nil {
			fields = append(fields, `max_guests = $`+strconv.Itoa(idx))
			args = append(args, *v)
			idx++
		}
	}
	if raw, ok := body["amenities"]; ok {
		fields = append(fields, `amenities = $`+strconv.Itoa(idx)+`::jsonb`)
		args = append(args, []byte(raw))
		idx++
	}
	if raw, ok := body["photos"]; ok {
		var arr []string
		if json.Unmarshal(raw, &arr) == nil && len(arr) >= 1 {
			b, _ := json.Marshal(arr)
			fields = append(fields, `photos = $`+strconv.Itoa(idx)+`::jsonb`)
			args = append(args, b)
			idx++
		}
	}

	if me.Role != "company" {
		if raw, ok := body["land_title_url"]; ok {
			var v *string
			_ = json.Unmarshal(raw, &v)
			fields = append(fields, `land_title_url = $`+strconv.Itoa(idx))
			args = append(args, strPtrOrNil(v))
			idx++
		}
		if raw, ok := body["land_title_cloudinary_id"]; ok {
			var v *string
			_ = json.Unmarshal(raw, &v)
			fields = append(fields, `land_title_cloudinary_id = $`+strconv.Itoa(idx))
			args = append(args, strPtrOrNil(v))
			idx++
		}
		if raw, ok := body["land_title_lat"]; ok {
			if f := floatPtrField(map[string]json.RawMessage{"x": raw}, "x"); f != nil {
				fields = append(fields, `land_title_lat = $`+strconv.Itoa(idx))
				args = append(args, *f)
				idx++
			}
		}
		if raw, ok := body["land_title_lng"]; ok {
			if f := floatPtrField(map[string]json.RawMessage{"x": raw}, "x"); f != nil {
				fields = append(fields, `land_title_lng = $`+strconv.Itoa(idx))
				args = append(args, *f)
				idx++
			}
		}
	}

	if len(fields) == 0 {
		jsonErr(c, http.StatusUnprocessableEntity, "No changes.")
		return
	}
	fields = append(fields, `updated_at = NOW()`)
	args = append(args, id)

	q := `UPDATE properties SET ` + strings.Join(fields, ", ") + ` WHERE id = $` + strconv.Itoa(idx) + ` AND deleted_at IS NULL`
	if _, err := s.Pool.Exec(c.Request.Context(), q, args...); err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not update listing.")
		return
	}

	row := s.Pool.QueryRow(c.Request.Context(), `SELECT `+strings.Join(propertySelectCols(), ",")+`
		FROM properties p JOIN users u ON u.id = p.seller_id WHERE p.id = $1`, id)
	propMap, _, err := scanPropertyWithSeller(row)
	if err != nil {
		c.JSON(http.StatusOK, map[string]string{"message": "Listing updated."})
		return
	}
	c.JSON(http.StatusOK, map[string]any{"message": "Listing updated.", "property": propMap})
}

func strPtrOrNil(p *string) any {
	if p == nil || strings.TrimSpace(*p) == "" {
		return nil
	}
	return strings.TrimSpace(*p)
}

func (s *Server) propertyDestroy(c *gin.Context) {
	me, _ := UserFromContext(c.Request.Context())
	id, err := uuid.Parse(c.Param("property"))
	if err != nil {
		jsonErr(c, http.StatusNotFound, "Resource not found.")
		return
	}

	cmd, err := s.Pool.Exec(c.Request.Context(), `
		UPDATE properties SET deleted_at = NOW(), updated_at = NOW()
		WHERE id = $1 AND seller_id = $2 AND deleted_at IS NULL
	`, id, me.ID)
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not delete listing.")
		return
	}
	if cmd.RowsAffected() == 0 {
		jsonErr(c, http.StatusForbidden, "Unauthorized.")
		return
	}
	c.JSON(http.StatusOK, map[string]string{"message": "Listing deleted."})
}

func (s *Server) myListings(c *gin.Context) {
	me, _ := UserFromContext(c.Request.Context())

	page := parsePageReq(c.Request)
	perPage := 20

	var total int64
	if err := s.Pool.QueryRow(c.Request.Context(), `SELECT COUNT(*) FROM properties WHERE seller_id = $1 AND deleted_at IS NULL`, me.ID).Scan(&total); err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not load listings.")
		return
	}

	offset := (page - 1) * perPage

	rows, err := s.Pool.Query(c.Request.Context(), `
		SELECT `+strings.Join(propertySelectCols(), ", ")+`,
		       (SELECT COUNT(*)::bigint FROM leads l WHERE l.property_id = p.id) AS leads_count,
		       (SELECT COUNT(*)::bigint FROM bookings b WHERE b.property_id = p.id) AS bookings_count
		FROM properties p
		JOIN users u ON u.id = p.seller_id
		WHERE p.seller_id = $1 AND p.deleted_at IS NULL
		ORDER BY p.created_at DESC
		LIMIT $2 OFFSET $3
	`, me.ID, perPage, offset)
	if err != nil {
		jsonErr(c, http.StatusInternalServerError, "Could not load listings.")
		return
	}
	defer rows.Close()

	out := []map[string]any{}
	for rows.Next() {
		prop, err := scanPropertySellerCounts(rows)
		if err != nil {
			jsonErr(c, http.StatusInternalServerError, "Could not load listings.")
			return
		}
		out = append(out, prop)
	}

	path := strings.TrimSuffix(c.Request.URL.Path, "/")
	c.JSON(http.StatusOK, response.Paginator(path, page, perPage, total, out))
}

func scanPropertySellerCounts(rows pgx.Rows) (map[string]any, error) {
	var (
		pid, pseller uuid.UUID
		title, desc  string
		price        int64
		location     string
		district     *string
		ptype, ltype string
		bed, bath    *int32
		size         *string
		photos, am   []byte
		maxGuests    *int32
		ppn          *float64
		pricePeriod  *string
		status       string
		featured     bool
		featUntil    *time.Time
		landURL      *string
		landCID      *string
		landLat      *float64
		landLng      *float64
		landVer      bool
		pCreated     time.Time
		pUpdated     time.Time

		sid        uuid.UUID
		sname      string
		srole      string
		sblue      bool
		sblueExp   *time.Time
		skyc       string
		scompany   *string
		sbooking   bool
		sellerCats []byte

		leadsCount    int64
		bookingsCount int64
	)

	err := rows.Scan(
		&pid, &pseller,
		&title, &desc, &price, &location, &district,
		&ptype, &ltype,
		&bed, &bath, &size, &photos, &am,
		&maxGuests, &ppn, &pricePeriod,
		&status, &featured, &featUntil,
		&landURL, &landCID, &landLat, &landLng, &landVer,
		&pCreated, &pUpdated,
		&sid, &sname, &srole, &sblue, &sblueExp, &skyc, &scompany, &sbooking, &sellerCats,
		&leadsCount, &bookingsCount,
	)
	if err != nil {
		return nil, err
	}

	su := &model.User{
		ID:                 sid,
		Name:               sname,
		Role:               srole,
		KycStatus:          skyc,
		BlueBadge:          sblue,
		BlueBadgeExpiresAt: sblueExp,
		CompanyName:        scompany,
		BookingEnabled:     sbooking,
		SellerCategories:   sellerCats,
	}

	prop := map[string]any{
		"id":                       pid.String(),
		"seller_id":                pseller.String(),
		"title":                    title,
		"description":              desc,
		"price":                    price,
		"location":                 location,
		"district":                 district,
		"property_type":            ptype,
		"listing_type":             ltype,
		"bedrooms":                 optionalInt(bed),
		"bathrooms":                optionalInt(bath),
		"size":                     size,
		"photos":                   decodeJSONArray(photos),
		"amenities":                decodeJSONArray(am),
		"max_guests":               optionalInt(maxGuests),
		"price_per_night":          ppn,
		"price_period":             pricePeriod,
		"status":                   status,
		"featured":                 featured,
		"featured_until":           timePtrRFC3339(featUntil),
		"land_title_url":           landURL,
		"land_title_cloudinary_id": landCID,
		"land_title_lat":           landLat,
		"land_title_lng":           landLng,
		"land_title_verified":      landVer,
		"created_at":               pCreated.UTC().Format(time.RFC3339Nano),
		"updated_at":               pUpdated.UTC().Format(time.RFC3339Nano),
		"seller":                   publicSeller(su),
		"leads_count":              leadsCount,
		"bookings_count":           bookingsCount,
	}
	return prop, nil
}
