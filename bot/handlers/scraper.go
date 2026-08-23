package handlers

import (
	"fmt"
	"golang.org/x/net/html"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/PuerkitoBio/goquery"
)

type ProblemStatement struct {
	Statement string
	Input     string
	Output    string
	Examples  []Example
	Note      string
	TimeLimit string
	MemLimit  string
}

type Example struct {
	Input  string
	Output string
}

var (
	scrapeCache   = map[string]*ProblemStatement{}
	scrapeCacheMu sync.RWMutex
)

func ScrapeProblem(contestID int, index string) (*ProblemStatement, error) {
	key := fmt.Sprintf("%d%s", contestID, index)

	scrapeCacheMu.RLock()
	if cached, ok := scrapeCache[key]; ok {
		scrapeCacheMu.RUnlock()
		return cached, nil
	}
	scrapeCacheMu.RUnlock()

	url := fmt.Sprintf("https://codeforces.com/problemset/problem/%d/%s", contestID, index)

	client := &http.Client{Timeout: 15 * time.Second}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("User-Agent", "DailyCodeforceBot/1.0 (github.com/ElizaldeJoseCS/DailyCodeforce)")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch page: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("HTTP %d from codeforces", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read body: %w", err)
	}

	doc, err := goquery.NewDocumentFromReader(strings.NewReader(string(body)))
	if err != nil {
		return nil, fmt.Errorf("parse html: %w", err)
	}

	ps := &ProblemStatement{}

	problemDiv := doc.Find("div.problem-statement")
	if problemDiv.Length() == 0 {
		return nil, fmt.Errorf("could not find problem statement div")
	}

	ps.TimeLimit = cleanPropertyValue(problemDiv.Find("div.header").Find("div.time-limit").Text())
	ps.MemLimit = cleanPropertyValue(problemDiv.Find("div.header").Find("div.memory-limit").Text())

	// Statement: collect all sibling paragraphs between header and input-specification
	header := problemDiv.Find("div.header")
	header.Each(func(_ int, h *goquery.Selection) {
		for _, sib := range h.NextAll().Nodes {
			sel := goquery.NewDocumentFromNode(sib)
			cls, _ := sel.Attr("class")
			if strings.Contains(cls, "input-specification") || strings.Contains(cls, "output-specification") || strings.Contains(cls, "sample-tests") || strings.Contains(cls, "note") {
				break
			}
			text := strings.TrimSpace(sel.Text())
			if text != "" {
				if ps.Statement != "" {
					ps.Statement += "\n\n"
				}
				ps.Statement += text
			}
		}
	})

	// Input spec: skip the section-title div, only get the paragraph content
	inputSpecDiv := problemDiv.Find("div.input-specification")
	var inputParts []string
	inputSpecDiv.Find("p").Each(func(_ int, p *goquery.Selection) {
		text := strings.TrimSpace(p.Text())
		if text != "" {
			inputParts = append(inputParts, text)
		}
	})
	ps.Input = strings.Join(inputParts, "\n")

	outputSpecDiv := problemDiv.Find("div.output-specification")
	var outputParts []string
	outputSpecDiv.Find("p").Each(func(_ int, p *goquery.Selection) {
		text := strings.TrimSpace(p.Text())
		if text != "" {
			outputParts = append(outputParts, text)
		}
	})
	ps.Output = strings.Join(outputParts, "\n")

	problemDiv.Find("div.sample-test").Each(func(i int, s *goquery.Selection) {
		inputs := s.Find("div.input pre")
		outputs := s.Find("div.output pre")
		count := inputs.Length()
		if outputs.Length() > count {
			count = outputs.Length()
		}
		for j := 0; j < count; j++ {
			input := extractPreText(inputs.Eq(j))
			output := extractPreText(outputs.Eq(j))
			if input != "" || output != "" {
				ps.Examples = append(ps.Examples, Example{
					Input:  input,
					Output: output,
				})
			}
		}
	})

	// Note: skip the section-title div, only get paragraph content
	noteDiv := problemDiv.Find("div.note")
	var noteParts []string
	noteDiv.Find("p").Each(func(_ int, p *goquery.Selection) {
		text := strings.TrimSpace(p.Text())
		if text != "" {
			noteParts = append(noteParts, text)
		}
	})
	ps.Note = strings.Join(noteParts, "\n")

	scrapeCacheMu.Lock()
	scrapeCache[key] = ps
	scrapeCacheMu.Unlock()

	log.Printf("Scraped problem %d%s: %d examples", contestID, index, len(ps.Examples))

	return ps, nil
}

func cleanText(s string) string {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, "\r\n", "\n")
	s = strings.ReplaceAll(s, "$$$", "")
	lines := strings.Split(s, "\n")
	var cleaned []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line != "" {
			cleaned = append(cleaned, line)
		}
	}
	return strings.Join(cleaned, "\n")
}

func cleanPropertyValue(s string) string {
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, "$$$", "")
	s = strings.TrimPrefix(s, "time limit per test")
	s = strings.TrimPrefix(s, "memory limit per test")
	return strings.TrimSpace(s)
}

func extractPreText(sel *goquery.Selection) string {
	var lines []string
	current := ""
	sel.Contents().Each(func(_ int, child *goquery.Selection) {
		if len(child.Nodes) == 0 {
			return
		}
		node := child.Nodes[0]
		if node.Type == html.TextNode {
			current += node.Data
		} else if node.Type == html.ElementNode {
			tag := goquery.NodeName(child)
			if tag == "br" {
				trimmed := strings.TrimSpace(current)
				if trimmed != "" {
					lines = append(lines, trimmed)
				}
				current = ""
			} else {
				if strings.TrimSpace(current) != "" {
					lines = append(lines, strings.TrimSpace(current))
					current = ""
				}
				text := strings.TrimSpace(child.Text())
				if text != "" {
					lines = append(lines, text)
				}
			}
		}
	})
	trimmed := strings.TrimSpace(current)
	if trimmed != "" {
		lines = append(lines, trimmed)
	}
	if len(lines) == 0 {
		return strings.TrimSpace(sel.Text())
	}
	return strings.Join(lines, "\n")
}

func CleanPgtags(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	if s[0] == '{' {
		s = s[1:]
	}
	if len(s) > 0 && s[len(s)-1] == '}' {
		s = s[:len(s)-1]
	}
	var tags []string
	current := ""
	inQuotes := false
	for _, ch := range s {
		if ch == '"' {
			inQuotes = !inQuotes
		} else if ch == ',' && !inQuotes {
			t := strings.TrimSpace(current)
			if t != "" {
				tags = append(tags, t)
			}
			current = ""
		} else {
			current += string(ch)
		}
	}
	t := strings.TrimSpace(current)
	if t != "" {
		tags = append(tags, t)
	}
	return strings.Join(tags, ", ")
}
