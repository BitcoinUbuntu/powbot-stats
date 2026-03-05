#!/usr/bin/env python3
"""
Process historical epoch data and generate stats-historical.json
Combines data from:
- Epoch 4 Testing (from CSV)
- Epochs 1-3 (from manual data)
"""

import csv
import json
from collections import defaultdict
from datetime import datetime

def get_platform(url):
    """Determine platform from URL"""
    if not url:
        return 'Nostr'
    url_lower = url.lower()
    if 'twitter.com' in url_lower or 'x.com' in url_lower:
        return 'X'
    return 'Nostr'

def strip_flag_emoji(name):
    """Remove flag emojis from project names"""
    import re
    # Flag emojis are in the range U+1F1E6 to U+1F1FF (regional indicator symbols)
    return re.sub(r'[\U0001F1E6-\U0001F1FF]{2}', '', name).strip()

def extract_country_flag(name):
    """Extract country flag emoji from project name"""
    import re
    match = re.search(r'[\U0001F1E6-\U0001F1FF]{2}', name)
    return match.group(0) if match else ''

def process_epoch4_testing_csv(csv_path):
    """Process Epoch 4 testing CSV and return structured data"""
    projects_data = defaultdict(lambda: {'posts': [], 'count': 0})
    merchants_data = defaultdict(lambda: {'posts': [], 'count': 0})
    all_posts = []

    with open(csv_path, 'r', encoding='utf-8') as f:
        # Skip the first row (info row)
        next(f)
        reader = csv.DictReader(f)
        for row in reader:
            # Skip header/info rows
            if not row.get('Project Name') or row['Project Name'].startswith('🤖'):
                continue

            project_name = row['Project Name'].strip()
            merchant_name = row['Merchant Name'].strip()
            post_url = row['Post URL'].strip()
            timestamp = row['Timestamp'].strip()
            notes = row.get('Notes', '').strip()

            # Skip only rejected posts (keep duplicates)
            if '❌' in notes:
                continue

            # Skip if no URL or .extra URLs
            if not post_url or post_url.endswith('.extra'):
                continue

            platform = get_platform(post_url)

            # Parse date
            try:
                dt = datetime.strptime(timestamp, '%Y-%m-%d %H:%M:%S %Z')
                date_str = dt.strftime('%Y-%m-%d')
            except:
                date_str = timestamp.split()[0] if timestamp else '2025-12-12'

            # Add to projects
            projects_data[project_name]['posts'].append({
                'url': post_url,
                'merchant': merchant_name,
                'date': date_str
            })
            projects_data[project_name]['count'] += 1

            # Add to merchants
            merchants_data[merchant_name]['posts'].append({
                'url': post_url,
                'project': project_name,
                'date': date_str
            })
            merchants_data[merchant_name]['count'] += 1

            all_posts.append({
                'url': post_url,
                'project': project_name,
                'merchant': merchant_name,
                'platform': platform,
                'date': date_str
            })

    # Sort posts by date for each project/merchant
    for project in projects_data.values():
        project['posts'].sort(key=lambda x: x['date'])
    for merchant in merchants_data.values():
        merchant['posts'].sort(key=lambda x: x['date'])

    # Convert to leaderboard format
    top_projects = [
        {
            'name': name,
            'count': data['count'],
            'posts': data['posts']
        }
        for name, data in projects_data.items()
    ]
    top_projects.sort(key=lambda x: x['count'], reverse=True)

    top_merchants = [
        {
            'name': name,
            'count': data['count'],
            'posts': data['posts']
        }
        for name, data in merchants_data.items()
    ]
    top_merchants.sort(key=lambda x: x['count'], reverse=True)

    # Count platforms
    platforms = defaultdict(int)
    for post in all_posts:
        platforms[post['platform']] += 1

    platforms_list = [
        {'platform': platform, 'count': count}
        for platform, count in sorted(platforms.items(), key=lambda x: x[1], reverse=True)
    ]

    # Extract countries from project names
    countries = {}
    for project_name in projects_data.keys():
        flag = extract_country_flag(project_name)
        if flag:
            # Get country name from project name (text before flag)
            country_name = project_name.split(flag)[0].strip()
            if '(' in country_name:
                country_name = country_name.split('(')[-1].strip().rstrip(')')
            if flag not in countries:
                countries[flag] = {'flag': flag, 'country': country_name, 'count': 0}
            countries[flag]['count'] += 1

    countries_list = sorted(countries.values(), key=lambda x: x['count'], reverse=True)

    return {
        'total_posts': len(all_posts),
        'top_projects': top_projects,
        'top_merchants': top_merchants,
        'platforms': platforms_list,
        'countries': countries_list
    }

def process_epoch_csv(csv_path):
    """Process epoch CSV (columns A and B only: Project Name, Post URL)"""
    projects_data = defaultdict(lambda: {'posts': [], 'count': 0})
    all_posts = []

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        # Skip header row
        next(reader)

        for row in reader:
            if not row or len(row) < 2:
                continue

            project_name = row[0].strip()
            post_url = row[1].strip()

            # Skip if no data
            if not project_name or not post_url:
                continue

            platform = get_platform(post_url)

            # Add to projects
            projects_data[project_name]['posts'].append({
                'url': post_url,
                'platform': platform
            })
            projects_data[project_name]['count'] += 1

            all_posts.append({
                'url': post_url,
                'project': project_name,
                'platform': platform
            })

    # Convert to leaderboard format
    top_projects = [
        {
            'name': name,
            'count': data['count'],
            'posts': data['posts']
        }
        for name, data in projects_data.items()
    ]
    top_projects.sort(key=lambda x: x['count'], reverse=True)

    # Count platforms
    platforms = defaultdict(int)
    for post in all_posts:
        platforms[post['platform']] += 1

    platforms_list = [
        {'platform': platform, 'count': count}
        for platform, count in sorted(platforms.items(), key=lambda x: x[1], reverse=True)
    ]

    # Extract countries from project names
    countries = {}
    for project_name in projects_data.keys():
        flag = extract_country_flag(project_name)
        if flag:
            # Get country name from project name (text before flag)
            country_name = project_name.split(flag)[0].strip()
            if '(' in country_name:
                country_name = country_name.split('(')[-1].strip().rstrip(')')
            if flag not in countries:
                countries[flag] = {'flag': flag, 'country': country_name, 'count': 0}
            countries[flag]['count'] += 1

    countries_list = sorted(countries.values(), key=lambda x: x['count'], reverse=True)

    return {
        'total_posts': len(all_posts),
        'top_projects': top_projects,
        'platforms': platforms_list,
        'countries': countries_list
    }

def main():
    # Process Epoch 4 Testing
    print("Processing Epoch 4 Testing data...")
    csv_path = r'C:\Users\glenn\Documents\Vibes\powbot-stats\Historical stats\Epoch4_testing_phase.csv'
    epoch4_testing = process_epoch4_testing_csv(csv_path)

    # Process Epochs 1-3
    print("Processing Epoch 1 (May 25) data...")
    epoch1 = process_epoch_csv(r'C:\Users\glenn\Documents\Vibes\powbot-stats\Historical stats\PoW Tracker Nov25–Feb26 - PoW May25.csv')

    print("Processing Epoch 2 (Aug 25) data...")
    epoch2 = process_epoch_csv(r'C:\Users\glenn\Documents\Vibes\powbot-stats\Historical stats\PoW Tracker Nov25–Feb26 - PoW Aug25.csv')

    print("Processing Epoch 3 (Nov 25) data...")
    epoch3 = process_epoch_csv(r'C:\Users\glenn\Documents\Vibes\powbot-stats\Historical stats\PoW Tracker Nov25–Feb26 - PoW Nov25.csv')

    # Combine all data
    historical_stats = {
        'generated_at': datetime.now().astimezone().replace(microsecond=0).isoformat(),
        'epochs': {
            'epoch1': {
                'name': 'Epoch 1',
                'period': 'May 2025',
                'total_posts': epoch1['total_posts'],
                'top_projects': epoch1['top_projects'],
                'platforms': epoch1['platforms'],
                'countries': epoch1['countries']
            },
            'epoch2': {
                'name': 'Epoch 2',
                'period': 'Aug 2025',
                'total_posts': epoch2['total_posts'],
                'top_projects': epoch2['top_projects'],
                'platforms': epoch2['platforms'],
                'countries': epoch2['countries']
            },
            'epoch3': {
                'name': 'Epoch 3',
                'period': 'Nov 2025',
                'total_posts': epoch3['total_posts'],
                'top_projects': epoch3['top_projects'],
                'platforms': epoch3['platforms'],
                'countries': epoch3['countries']
            },
            'epoch4_testing': {
                'name': 'Epoch 4 Testing',
                'period': 'Dec 2025',
                'total_posts': epoch4_testing['total_posts'],
                'top_projects': epoch4_testing['top_projects'],
                'top_merchants': epoch4_testing['top_merchants'],
                'platforms': epoch4_testing['platforms'],
                'countries': epoch4_testing['countries']
            }
        }
    }

    # Write to file
    output_path = 'stats-historical.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(historical_stats, f, indent=2, ensure_ascii=False)

    # Write to console with safe encoding
    with open(output_path + '.summary.txt', 'w', encoding='utf-8') as f:
        f.write(f"Generated {output_path}\n\n")
        f.write(f"SUMMARY OF ALL EPOCHS:\n")
        f.write(f"=" * 80 + "\n\n")

        f.write(f"Epoch 1 (May 2025):\n")
        f.write(f"  Total posts: {epoch1['total_posts']}\n")
        f.write(f"  Projects: {len(epoch1['top_projects'])}\n")
        f.write(f"  Countries: {len(epoch1['countries'])}\n\n")

        f.write(f"Epoch 2 (Aug 2025):\n")
        f.write(f"  Total posts: {epoch2['total_posts']}\n")
        f.write(f"  Projects: {len(epoch2['top_projects'])}\n")
        f.write(f"  Countries: {len(epoch2['countries'])}\n\n")

        f.write(f"Epoch 3 (Nov 2025):\n")
        f.write(f"  Total posts: {epoch3['total_posts']}\n")
        f.write(f"  Projects: {len(epoch3['top_projects'])}\n")
        f.write(f"  Countries: {len(epoch3['countries'])}\n\n")

        f.write(f"Epoch 4 Testing (Dec 2025):\n")
        f.write(f"  Total posts: {epoch4_testing['total_posts']}\n")
        f.write(f"  Projects: {len(epoch4_testing['top_projects'])}\n")
        f.write(f"  Merchants: {len(epoch4_testing['top_merchants'])}\n")
        f.write(f"  Countries: {len(epoch4_testing['countries'])}\n\n")

        f.write(f"TOTAL HISTORICAL POSTS: {epoch1['total_posts'] + epoch2['total_posts'] + epoch3['total_posts'] + epoch4_testing['total_posts']}\n")

    print(f"\nGenerated {output_path}")
    print(f"Epoch 1: {epoch1['total_posts']} posts")
    print(f"Epoch 2: {epoch2['total_posts']} posts")
    print(f"Epoch 3: {epoch3['total_posts']} posts")
    print(f"Epoch 4 Testing: {epoch4_testing['total_posts']} posts")
    print(f"TOTAL: {epoch1['total_posts'] + epoch2['total_posts'] + epoch3['total_posts'] + epoch4_testing['total_posts']} posts")

if __name__ == '__main__':
    main()
