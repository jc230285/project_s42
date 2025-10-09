import mysql.connector

conn = mysql.connector.connect(
    host='10.1.8.51',
    user='s42project',
    password='s42project',
    database='nocodb'
)

cursor = conn.cursor(dictionary=True)
cursor.execute('SELECT email, nocodb_api FROM users WHERE email = %s', ('james@scale-42.com',))
result = cursor.fetchone()

print(f'Email: {result["email"]}')
print(f'Token in DB: {result["nocodb_api"]}')
print(f'Token is NULL: {result["nocodb_api"] is None}')

conn.close()
