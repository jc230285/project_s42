# Architecture and Deployment Notes
Try and run with as little tokens as posablesible

## Local Development

- **Frontend:** Always run on port `3150`. Fronent is N
- **Backend:** Always run on port `8150`. Backends running Fast API
- Both services run in Docker.
- Before starting, clear all containers and Windows services using these ports.
- Rebuild as needed, then push changes to GitHub.

## Production

- **Frontend:** [https://s42.edbmotte.com](https://s42.edbmotte.com)
- **Backend:** [https://s42api.edbmotte.com](https://s42api.edbmotte.com)
- Deployment managed via Coolify (Docker) and GitHub.
- Always use the production SQL database and NocoDB API.
- Backend is built with FastAPI.

---

## Google Authentication

- On login, create a user and a group based on the user's domain.
- Automatically assign the user to their domain group.

---

## Frontend Page Access

Add authentication to pages based on user group membership.

### Menu Items and Page Access

| Section                   | Page/Menu Item     | Access Group                |
|---------------------------|--------------------|-----------------------------|
| **Dashboard**             | Home               | Any logged-in user          |
| **Projects**              | Projects           | Scale42 user group only     |
|                           | Map                | Scale42 user group only     |
|                           | Schema             | Scale42 user group only     |
| **Hoyanger Power**        | Overview           | Scale42 user group only     |
| **Account Management**    | Accounts           | Scale42 user group only     |
| **Tools**                 | n8n                | Any logged-in user          |
|                           | nocodb             | Any logged-in user          |
|                           | drive              | Any logged-in user          |
|                           | notion             | Any logged-in user          |
| **Settings**              | Users              | Scale42 user group only     |
|                           | Logout             | Any logged-in user          |
|---------------------------|--------------------|-----------------------------|

**Note:**  
Only members of the `Scale42` user group can access restricted pages and menu items.
Unauthorized users will be redirected to the home page.
---