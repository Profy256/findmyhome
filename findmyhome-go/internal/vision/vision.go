package vision

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

const endpoint = "https://vision.googleapis.com/v1/images:annotate"

type Client struct {
	apiKey string
	http   *http.Client
}

func New(apiKey string) *Client {
	return &Client{
		apiKey: apiKey,
		http:   &http.Client{Timeout: 20 * time.Second},
	}
}

// AnalyzeDocument returns a confidence score 0–100 for whether the image
// looks like a valid identity or business-registration document.
func (c *Client) AnalyzeDocument(ctx context.Context, imageURL, docType string) (score int, err error) {
	body, _ := json.Marshal(map[string]any{
		"requests": []map[string]any{{
			"image": map[string]any{
				"source": map[string]string{"imageUri": imageURL},
			},
			"features": []map[string]any{
				{"type": "LABEL_DETECTION", "maxResults": 30},
				{"type": "DOCUMENT_TEXT_DETECTION"},
			},
		}},
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		endpoint+"?key="+c.apiKey, bytes.NewReader(body))
	if err != nil {
		return 0, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	var result struct {
		Responses []struct {
			LabelAnnotations []struct {
				Description string  `json:"description"`
				Score       float64 `json:"score"`
			} `json:"labelAnnotations"`
			FullTextAnnotation *struct {
				Text string `json:"text"`
			} `json:"fullTextAnnotation"`
			Error *struct {
				Message string `json:"message"`
			} `json:"error"`
		} `json:"responses"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return 0, fmt.Errorf("decode: %w", err)
	}
	if len(result.Responses) == 0 {
		return 0, fmt.Errorf("empty vision response")
	}
	r := result.Responses[0]
	if r.Error != nil {
		return 0, fmt.Errorf("vision api: %s", r.Error.Message)
	}

	return computeScore(r.LabelAnnotations, r.FullTextAnnotation, docType), nil
}

// idKeywords are label keywords that indicate a personal identity document.
var idKeywords = []string{
	"identity document", "id card", "national identity", "photo identification",
	"passport", "driver's license", "driving licence", "personal identification",
	"document", "government", "certificate", "travel document",
}

// businessKeywords are label keywords that indicate a business document.
var businessKeywords = []string{
	"certificate", "document", "business", "registration", "official",
	"legal", "government", "text", "paper", "font",
}

// textMarkers: if extracted text contains these strings it's a strong signal.
var idTextMarkers = []string{
	"national id", "republic of uganda", "passport no", "driver", "licence",
	"date of birth", "surname", "given name", "nationality", "expiry",
}
var businessTextMarkers = []string{
	"certificate of incorporation", "uganda registration", "ursb",
	"business name", "registration number", "company",
}

func computeScore(
	labels []struct {
		Description string  `json:"description"`
		Score       float64 `json:"score"`
	},
	text *struct{ Text string `json:"text"` },
	docType string,
) int {
	keywords := idKeywords
	textMarkers := idTextMarkers
	if docType == "business_registration" {
		keywords = businessKeywords
		textMarkers = businessTextMarkers
	}

	// Best matching label score.
	best := 0.0
	for _, lbl := range labels {
		desc := strings.ToLower(lbl.Description)
		for _, kw := range keywords {
			if strings.Contains(desc, kw) || strings.Contains(kw, desc) {
				if lbl.Score > best {
					best = lbl.Score
				}
				break
			}
		}
	}

	labelScore := int(best * 100)

	// Boost score if extracted text contains known document markers.
	textBoost := 0
	if text != nil {
		lower := strings.ToLower(text.Text)
		for _, m := range textMarkers {
			if strings.Contains(lower, m) {
				textBoost += 15
				break
			}
		}
	}

	total := labelScore + textBoost
	if total > 100 {
		total = 100
	}
	return total
}
