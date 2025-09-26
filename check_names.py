import mysql.connector

conn = mysql.connector.connect(
    host='10.1.8.51',
    user='s42project',
    password='9JA_)j(WSqJUJ9Y]',
    database='nocodb',
    port=3306
)

cursor = conn.cursor(dictionary=True)

# Check full_name field values
cursor.execute('SELECT id, full_name, business_name, first_name, last_name FROM companies WHERE full_name IS NOT NULL AND full_name != "" LIMIT 5')
results = cursor.fetchall()

print('Sample company names:')
for row in results:
    print(f'ID {row["id"]}: full_name="{row["full_name"]}", business_name="{row["business_name"]}", first_name="{row["first_name"]}", last_name="{row["last_name"]}"')

cursor.close()
conn.close()