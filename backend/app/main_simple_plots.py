from fastapi import FastAPI, Depends, HTTPException, status, Header, Query
from fastapi.responses import JSONResponse
import requests
import json
import base64
import os
from typing import Optional

app = FastAPI()

async def get_current_user(authorization: Optional[str] = Header(None)):
    """Simple auth validation"""
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    
    try:
        if not authorization.startswith("Bearer "):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
        
        token = authorization[7:]
        if len(token) < 10:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
        
        try:
            user_info = json.loads(base64.b64decode(token).decode('utf-8'))
            return user_info
        except:
            return {"email": "authenticated@user.com", "authenticated": True}
        
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

@app.get("/projects/plots-simple")
def get_plots_simple(current_user: dict = Depends(get_current_user), plot_ids: Optional[str] = Query(None)):
    """Simplified plots endpoint for testing plot selection"""
    try:
        # Get NocoDB configuration
        nocodb_api_url = os.getenv("NOCODB_API_URL")
        nocodb_api_token = os.getenv("NOCODB_API_TOKEN")
        nocodb_plots_table_id = os.getenv("NOCODB_PLOTS_TABLE_ID", "mmqclkrvx9lbtpc")
        
        if not nocodb_api_url or not nocodb_api_token:
            return JSONResponse(content={"error": "NocoDB configuration missing"}, status_code=500)
        
        headers = {"xc-token": nocodb_api_token, "Content-Type": "application/json"}
        
        # Parse plot IDs
        selected_plot_ids = []
        if plot_ids:
            selected_plot_ids = [pid.strip() for pid in plot_ids.split(',') if pid.strip()]
        
        print(f"DEBUG: Received plot_ids: {plot_ids}")
        print(f"DEBUG: Parsed selected_plot_ids: {selected_plot_ids}")
        
        # Get plots data
        plots_url = f"{nocodb_api_url}/api/v2/tables/{nocodb_plots_table_id}/records"
        plots_params = {"limit": 1000, "offset": 0}
        plots_response = requests.get(plots_url, headers=headers, params=plots_params, verify=False)
        
        if plots_response.status_code != 200:
            return JSONResponse(content={"error": f"Failed to fetch plots: {plots_response.status_code}"}, status_code=500)
        
        plots_data = plots_response.json()
        all_plots = plots_data.get("list", [])
        
        print(f"DEBUG: Total plots in database: {len(all_plots)}")
        if all_plots:
            sample_plot_ids = [plot.get("Plot ID", "") for plot in all_plots[:3]]
            print(f"DEBUG: Sample plot IDs: {sample_plot_ids}")
        
        # Filter plots if specific IDs requested
        if selected_plot_ids:
            filtered_plots = []
            for plot in all_plots:
                plot_id = plot.get("Plot ID", "")
                if plot_id in selected_plot_ids:
                    filtered_plots.append(plot)
            print(f"DEBUG: Found {len(filtered_plots)} matching plots")
        else:
            filtered_plots = all_plots
        
        # Simple response structure
        return JSONResponse(content={
            "plots": [{"id": plot.get("Id"), "plot_id": plot.get("Plot ID"), "data": plot} for plot in filtered_plots],
            "selected_plot_ids": selected_plot_ids,
            "plots_count": len(filtered_plots),
            "total_plots_available": len(all_plots),
            "debug": {
                "received_plot_ids": plot_ids,
                "parsed_plot_ids": selected_plot_ids,
                "total_in_db": len(all_plots),
                "filtered_count": len(filtered_plots),
                "sample_db_plot_ids": [plot.get("Plot ID", "") for plot in all_plots[:5]]
            }
        })
        
    except Exception as e:
        print(f"ERROR in plots-simple: {e}")
        return JSONResponse(content={"error": f"Unexpected error: {str(e)}"}, status_code=500)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)