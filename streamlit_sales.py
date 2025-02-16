import streamlit as st
import pandas as pd
import plotly.express as px
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from datetime import datetime, timedelta
from sqlalchemy import create_engine

@st.cache_resource
def get_db_connection():
    engine = create_engine(f"mysql+mysqlconnector://root:raghav@localhost/inventory")  # Modify credentials
    return engine

def fetch_sales_data():
    engine = get_db_connection()
    query = """
        SELECT s.date, s.total, s.payment_method, si.product_name, si.quantity, si.sale_price
        FROM sales s
        JOIN sale_items si ON s.id = si.sale_id
    """
    df = pd.read_sql(query, engine)  # Use SQLAlchemy engine
    return df

# Load Data
st.title("📊 Sales Dashboard & Prediction")
st.sidebar.header("Navigation")
option = st.sidebar.radio("Choose an Option", ["Visualize Sales", "Predict Sales"])

data = fetch_sales_data()
data['date'] = pd.to_datetime(data['date'])

if option == "Visualize Sales":
    st.header("Sales Data Overview")
    st.dataframe(data)

    # Total Sales Over Time
    st.subheader("Total Sales Over Time")
    sales_trend = data.groupby(data['date'].dt.date)['total'].sum().reset_index()
    fig = px.line(sales_trend, x='date', y='total', title='Total Sales Trend')
    st.plotly_chart(fig)

    # Top Selling Products
    st.subheader("Top Selling Products")
    top_products = data.groupby('product_name')['quantity'].sum().reset_index().sort_values(by='quantity', ascending=False)
    fig = px.bar(top_products.head(10), x='product_name', y='quantity', title='Top 10 Selling Products')
    st.plotly_chart(fig)

elif option == "Predict Sales":
    st.header("📈 Sales Prediction")
    
    # Prepare Data for Prediction
    sales_trend = data.groupby(['date', 'product_name'])['quantity'].sum().reset_index()
    sales_trend['date'] = pd.to_datetime(sales_trend['date'])
    sales_trend['days'] = (sales_trend['date'] - sales_trend['date'].min()).dt.days
    
    product_models = {}
    future_predictions = []
    future_days = 30  # Predict next 30 days
    future_dates = [(sales_trend['date'].max() + timedelta(days=i)) for i in range(1, future_days+1)]
    
    for product in sales_trend['product_name'].unique():
        product_data = sales_trend[sales_trend['product_name'] == product]
        X = product_data[['days']]
        y = product_data['quantity']
        
        if len(X) > 1:
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
            model = LinearRegression()
            model.fit(X_train, y_train)
            product_models[product] = model
            
            future_X = pd.DataFrame({'days': [(d - sales_trend['date'].min()).days for d in future_dates]})
            future_sales = model.predict(future_X)
            
            future_df = pd.DataFrame({'date': future_dates, 'predicted_sales': future_sales, 'product_name': product})
            future_predictions.append(future_df)
    
    if future_predictions:
        future_df = pd.concat(future_predictions)
        fig = px.line(future_df, x='date', y='predicted_sales', color='product_name', title='Predicted Sales for Next 30 Days by Product')
        st.plotly_chart(fig)
        st.write(future_df)
    
    # # Predict Total Sales Revenue
    # total_sales_trend = data.groupby(data['date'].dt.date)['total'].sum().reset_index()
    # total_sales_trend['days'] = (total_sales_trend['date'] - total_sales_trend['date'].min()).dt.days
    total_sales_trend = data.groupby(data['date'].dt.date)['total'].sum().reset_index()

    # Ensure the date column is in datetime format
    total_sales_trend['date'] = pd.to_datetime(total_sales_trend['date'])

    total_sales_trend['days'] = (total_sales_trend['date'] - total_sales_trend['date'].min()).dt.days

    
    X_total = total_sales_trend[['days']]
    y_total = total_sales_trend['total']
    
    if len(X_total) > 1:
        X_train, X_test, y_train, y_test = train_test_split(X_total, y_total, test_size=0.2, random_state=42)
        total_model = LinearRegression()
        total_model.fit(X_train, y_train)
        
        future_X_total = pd.DataFrame({'days': [(d - total_sales_trend['date'].min()).days for d in future_dates]})
        future_total_sales = total_model.predict(future_X_total)
        
        future_total_df = pd.DataFrame({'date': future_dates, 'predicted_total_sales': future_total_sales})
        fig_total = px.line(future_total_df, x='date', y='predicted_total_sales', title='Predicted Total Sales Revenue for Next 30 Days')
        st.plotly_chart(fig_total)
        st.write(future_total_df)