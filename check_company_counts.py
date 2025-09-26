import mysql.connector

conn = mysql.connector.connect(
    host='10.1.8.51',
    user='s42project',
    password='9JA_)j(WSqJUJ9Y]',
    database='nocodb',
    port=3306
)

cursor = conn.cursor(dictionary=True)

# Check type breakdown
cursor.execute('SELECT type, COUNT(*) as count FROM companies GROUP BY type')
results = cursor.fetchall()
print('Company type breakdown:')
for row in results:
    print(f'  {row["type"]}: {row["count"]}')

# Check total
cursor.execute('SELECT COUNT(*) as total FROM companies')
total = cursor.fetchone()
print(f'Total companies: {total["total"]}')

cursor.close()
conn.close()