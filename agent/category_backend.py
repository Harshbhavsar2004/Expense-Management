from __future__ import annotations
import json
import os
from typing import Optional
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from google.adk.agents import LlmAgent

# -----------------------------------------------------------------------------
# CATEGORY AGENT DEFINITION
# -----------------------------------------------------------------------------

CATEGORY_PROMPT = """You are an expert expense categorization agent for Fristine Infotech.
Your job is to determine the most accurate category for an expense based on the merchant name, date, and time.

PRIMARY CATEGORIES:
- Meals (Food, Drinks, Restaurants, Cafes, Zomato, Swiggy, Instamart)
- Travel Expenses (Taxis, Flights, Trains, Cabs, Tolls, Tours, Travels, Uber, Ola, Rapido, Redbus)
- Hotel Accommodation (Hotels, Lodges, Stay, OYO, Airbnb, Makemytrip)
- Communication (Jio, Airtel, Vodafone, Internet)
- Office Supplies (Amazon, Flipkart stationary, Zepto, Blinkit)
- Miscellaneous (Anything else)

SPECIAL MEAL LOGIC:
If the primary category is 'Meals', you MUST refine it based on the transaction time:
- 06:00 - 11:30 -> Food (Breakfast)
- 11:30 - 15:30 -> Food (Lunch)
- 15:30 - 18:30 -> Food (Snacks)
- 18:30 - 23:59 -> Food (Dinner)
- If time is missing but it's a meal -> Food (General)

INPUT:
Merchant: {merchant}
Date: {date}
Time: {time}

Return ONLY a valid JSON object:
{{
  "category": "The refined category name",
  "confidence": 0.0-1.0,
  "reasoning": "Short 1-sentence explanation"
}}
"""

category_backend_router = APIRouter(prefix="/category")

@category_backend_router.post("/predict")
async def predict_category(request: Request) -> JSONResponse:
    try:
        body = await request.json()
        merchant = body.get("merchant", "Unknown")
        date = body.get("date", "Unknown")
        time = body.get("time", "Unknown")

        # In a real implementation, we would call an LLM here.
        # For this demonstration, we'll use a simple logic + call the internal ADK agent if needed.
        # But we'll implement the logic directly for speed and reliability.
        
        # Simple keyword matching first for reliability
        merchant_lower = merchant.lower()
        
        category = "Miscellaneous"
        
        # Travel
        if any(kw in merchant_lower for kw in ["tours", "travels", "transport", "taxi", "uber", "ola", "indigo", "air india", "rapido", "redbus", "irctc"]):
            category = "Travel Expenses"
        # Hotel
        elif any(kw in merchant_lower for kw in ["hotel", "lodge", "inn", "suites", "oyo", "makemytrip", "airbnb", "stay"]):
            category = "Hotel Accommodation"
        # Food
        elif any(kw in merchant_lower for kw in ["restraurant", "restaurant", "cafe", "food", "dining", "swiggy", "zomato", "kfc", "mcdonald", "instamart", "starbucks", "eats"]):
            category = "Meals"
        # Communication
        elif any(kw in merchant_lower for kw in ["jio", "airtel", "vodafone", "vi ", "recharge", "internet", "broadband"]):
            category = "Communication"
        # Supplies
        elif any(kw in merchant_lower for kw in ["amazon", "flipkart", "zepto", "blinkit", "stationary", "supplies"]):
            category = "Office Supplies"
            
        # Refine Meals if time is present
        if category == "Meals" and time != "Unknown" and time:
            # Simple HH:MM parser
            try:
                # Handle cases like "01:00 PM"
                time_part = time.split()[0]
                is_pm = "PM" in time.upper()
                hh, mm = map(int, time_part.split(":"))
                if is_pm and hh < 12: hh += 12
                if not is_pm and hh == 12: hh = 0
                
                total_minutes = hh * 60 + mm
                if 360 <= total_minutes < 690: # 6:00 - 11:30
                    category = "Food (Breakfast)"
                elif 690 <= total_minutes < 930: # 11:30 - 15:30
                    category = "Food (Lunch)"
                elif 930 <= total_minutes < 1110: # 15:30 - 18:30
                    category = "Food (Snacks)"
                else:
                    category = "Food (Dinner)"
            except:
                category = "Food (General)"
        elif category == "Meals":
            category = "Food (General)"

        return JSONResponse({
            "success": True,
            "category": category,
            "reasoning": f"Based on merchant '{merchant}' and time '{time}'"
        })

    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)

category_agent = LlmAgent(
    name="CategoryAgent",
    model="gemini-2.5-flash",
    instruction="Categorize expenses based on merchant, date, and time."
)
