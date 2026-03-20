#!/usr/bin/env python3
"""
Split vision_mission HTML field into separate vision and mission text fields.
"""
import json
import re
from html.parser import HTMLParser

class TextExtractor(HTMLParser):
    """Extract text from HTML."""
    def __init__(self):
        super().__init__()
        self.text = []

    def handle_data(self, data):
        self.text.append(data.strip())

    def get_text(self):
        return ' '.join(filter(None, self.text))

def extract_text(html):
    """Extract plain text from HTML."""
    if not html:
        return ''
    extractor = TextExtractor()
    extractor.feed(html)
    return extractor.get_text()

def split_vision_mission(html_content):
    """Split vision_mission HTML into vision and mission text."""
    if not html_content:
        return '', ''

    # Split by heading tags
    parts = re.split(r'<h3>.*?</h3>', html_content, flags=re.IGNORECASE)
    headings = re.findall(r'<h3>(.*?)</h3>', html_content, flags=re.IGNORECASE)

    vision = ''
    mission = ''

    # Match headings to their content
    for i, heading in enumerate(headings):
        heading_text = heading.strip().lower()
        content_html = parts[i + 1] if i + 1 < len(parts) else ''
        content_text = extract_text(content_html)

        if 'vision' in heading_text:
            vision = content_text
        elif 'mission' in heading_text:
            mission = content_text

    return vision, mission

# Load members.json
with open('members.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Process each member
updated_count = 0
for member in data['members']:
    if 'vision_mission' in member and member['vision_mission']:
        vision, mission = split_vision_mission(member['vision_mission'])

        # Add new fields
        member['vision'] = vision
        member['mission'] = mission

        # Remove old field
        del member['vision_mission']

        updated_count += 1
        print(f"Updated: {member['name']}")
        if vision:
            print(f"  Vision: {vision[:60]}...")
        if mission:
            print(f"  Mission: {mission[:60]}...")
        print()

# Save updated members.json
with open('members.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"\nUpdated {updated_count} members")
print("Saved to members.json")
