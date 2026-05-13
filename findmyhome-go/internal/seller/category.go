package seller

var Thresholds = map[string]int{
	"land":      95,
	"apartment": 90,
	"house":     90,
	"rental":    80,
	"airbnb":    80,
	"lodge":     80,
}

var Labels = map[string]string{
	"house":     "Houses",
	"airbnb":    "Airbnb",
	"lodge":     "Lodges",
	"rental":    "Rentals",
	"apartment": "Apartments",
	"land":      "Land",
}

var PropertyTypeToCategory = map[string]string{
	"house":     "house",
	"airbnb":    "airbnb",
	"lodge":     "lodge",
	"rental":    "rental",
	"apartment": "apartment",
	"land":      "land",
}

var StrictnessLabels = map[string]string{
	"land":      "Very strict — land title required per listing",
	"apartment": "Moderate — slightly higher KYC scrutiny",
	"house":     "Moderate — higher KYC scrutiny for property sales",
	"rental":    "Light — National ID is sufficient",
	"airbnb":    "Light — National ID is sufficient",
	"lodge":     "Light — National ID is sufficient",
}

func KycThreshold(categories []string) int {
	if len(categories) == 0 {
		return 90
	}
	max := 80
	for _, c := range categories {
		t := Thresholds[c]
		if t == 0 {
			t = 80
		}
		if t > max {
			max = t
		}
	}
	return max
}

func StrictestCategory(categories []string) string {
	if len(categories) == 0 {
		return ""
	}
	th := Thresholds
	best := categories[0]
	bestScore := th[best]
	if bestScore == 0 {
		bestScore = 80
	}
	for _, c := range categories[1:] {
		sc := th[c]
		if sc == 0 {
			sc = 80
		}
		if sc >= bestScore {
			bestScore = sc
			best = c
		}
	}
	return best
}

func KycMessage(strictest string) string {
	switch strictest {
	case "land":
		return "You have selected Land. We are very strict on land sellers. Upload a clear National ID or Passport. You will also need to upload a land title for every land listing."
	case "apartment":
		return "You have selected Apartments. We take extra care to verify apartment sellers. Upload a clear National ID or Passport."
	default:
		return "Upload a clear National ID or Passport to get verified. Verification is quick and free."
	}
}

// strictTypes lists the only property types that require a matching registered category.
// All other types (lodge, rental, apartment, airbnb) are open to any verified seller.
var strictTypes = map[string]bool{
	"land":  true,
	"house": true,
}

func CanListType(sellerCategories []string, propertyType string, role string) bool {
	if role == "admin" || role == "company" {
		return true
	}
	if !strictTypes[propertyType] {
		return true
	}
	required := PropertyTypeToCategory[propertyType]
	if required == "" {
		return true
	}
	for _, c := range sellerCategories {
		if c == required {
			return true
		}
	}
	return false
}

func RequiresLandTitle(propertyType string, role string) bool {
	if role == "company" {
		return false
	}
	return propertyType == "land"
}

func RegistrationInfoMap() map[string]map[string]any {
	return map[string]map[string]any{
		"land": {
			"label":       "Land",
			"description": "Sell land plots. We are very strict — you must upload a land title for every land listing to protect buyers from fraud.",
			"requires":    []string{"National ID or Passport", "Land title document per listing (mandatory)"},
			"kyc_level":   "Strict",
			"color":       "red",
		},
		"apartment": {
			"label":       "Apartments",
			"description": "Sell or rent apartments. We are moderately strict — apartments involve large amounts of money.",
			"requires":    []string{"National ID or Passport"},
			"kyc_level":   "Moderate",
			"color":       "amber",
		},
		"house": {
			"label":       "Houses",
			"description": "Sell houses. Moderate verification — a clear National ID or Passport is required.",
			"requires":    []string{"National ID or Passport"},
			"kyc_level":   "Moderate",
			"color":       "amber",
		},
		"rental": {
			"label":       "Rentals",
			"description": "List long-term rentals. Light verification — National ID is sufficient.",
			"requires":    []string{"National ID or Passport"},
			"kyc_level":   "Light",
			"color":       "green",
		},
		"airbnb": {
			"label":       "Airbnb",
			"description": "List short-stay properties for daily/weekly stays. Light verification — National ID is sufficient.",
			"requires":    []string{"National ID or Passport"},
			"kyc_level":   "Light",
			"color":       "green",
		},
		"lodge": {
			"label":       "Lodge / Guest House",
			"description": "List lodges and guest houses. Light verification — National ID is sufficient.",
			"requires":    []string{"National ID or Passport"},
			"kyc_level":   "Light",
			"color":       "green",
		},
	}
}

func ListingTypeForPropertyType(pt string) string {
	switch pt {
	case "airbnb", "lodge":
		return "short_stay"
	case "apartment", "rental":
		return "rent"
	default:
		return "sale"
	}
}
