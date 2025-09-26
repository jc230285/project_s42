import mysql.connector

conn = mysql.connector.connect(
    host='10.1.8.51',
    user='s42project',
    password='9JA_)j(WSqJUJ9Y]',
    database='nocodb',
    port=3306
)

cursor = conn.cursor()

# Check if any company names match developer names
cursor.execute('SELECT full_name FROM companies WHERE type = "BUSINESS"')
company_names = [row[0] for row in cursor.fetchall()]

cursor.execute('SELECT DISTINCT developer FROM Licenses WHERE developer IS NOT NULL')
developers = [row[0] for row in cursor.fetchall()]

print('Checking for matches between company names and developers:')
matches = set(company_names) & set(developers)
if matches:
    print(f'Found {len(matches)} matching companies/developers:')
    for match in matches:
        print(f'  {match}')
else:
    print('No direct matches found between company names and developers')

# Check total capacity by developer
cursor.execute('''
    SELECT developer, SUM(capacitymw) as total_capacity, COUNT(*) as license_count
    FROM Licenses
    WHERE developer IS NOT NULL AND capacitymw > 0
    GROUP BY developer
    ORDER BY total_capacity DESC
    LIMIT 10
''')
capacity_by_developer = cursor.fetchall()

print(f'\nTop developers by total capacity (from {len(capacity_by_developer)} developers with capacity > 0):')
for dev in capacity_by_developer:
    print(f'  {dev[0]}: {dev[1]} MW across {dev[2]} licenses')

cursor.close()
conn.close()