package models

type Node struct {
	NodeID          int    `json:"node_id"`
	NodeName        string `json:"node_name"`
	NodeDescription string `json:"node_description"` // Fixed duplicated field name
	Sites           []Site `json:"child_sites"`      // on node has list of sites
}

type Site struct {
	SiteID    int    `json:"site_id"`   // Corrected field name
	SiteName  string `json:"site_name"` // Corrected field name
	ParentID  int    `json:"parent_id"`
	ChildSite []Site `json:"child_sites"` // Changed field name to be consistent
	Pages     []Page `json:"pages"`
}

type Page struct {
	ID       int    `json:"id"`
	Pagename string `json:"pagename"`
}
