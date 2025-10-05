import mysql.connector

conn = mysql.connector.connect(
    host='10.1.8.51',
    user='nocodb',
    password='4VYFrBsNDZ-qW4WiEzkC',
    database='nocodb'
)

cursor = conn.cursor(dictionary=True)

# Check james@scale-42.com groups
cursor.execute("""
    SELECT u.email, g.name
    FROM users u
    JOIN user_groups ug ON u.id = ug.user_id
    JOIN groups g ON ug.group_id = g.id
    WHERE u.email = %s AND ug.is_active = TRUE
""", ('james@scale-42.com',))

groups = cursor.fetchall()

print('Groups for james@scale-42.com:')
for g in groups:
    print(f"  - {g['name']}")

# Check Debug page permissions
cursor.execute("""
    SELECT p.name, g.name as group_name, pp.permission_level
    FROM pages p
    JOIN page_permissions pp ON p.id = pp.page_id
    JOIN groups g ON pp.group_id = g.id
    WHERE p.name = 'Debug' AND pp.is_active = TRUE
""")

debug_perms = cursor.fetchall()

print('\nDebug page permissions:')
for perm in debug_perms:
    print(f"  - {perm['group_name']}: {perm['permission_level']}")

cursor.close()
conn.close()
