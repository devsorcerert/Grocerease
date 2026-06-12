import React, { useState, useEffect } from 'react';
import api from '../services/api';
import '../styles/App.css';

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [updating, setUpdating] = useState(null);

  useEffect(() => {
    fetchOrders();
  }, [filterStatus]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const url = filterStatus ? `/admin/orders?status=${filterStatus}` : '/admin/orders';
      const response = await api.get(url);
      setOrders(response.data.orders || []);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      alert('Failed to load orders.');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    if (!window.confirm(`Update order status to ${newStatus}?`)) return;
    try {
      setUpdating(orderId);
      await api.put(`/admin/orders/${orderId}/status`, { status: newStatus });
      fetchOrders();
    } catch (error) {
      alert('Failed to update status');
    } finally {
      setUpdating(null);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'payment_pending': return '#F59E0B';
      case 'confirmed': return '#3B82F6';
      case 'preparing': return '#8B5CF6';
      case 'picked_up': return '#F97316';
      case 'out_for_delivery': return '#EAB308';
      case 'delivered': return '#10B981';
      case 'cancelled': return '#EF4444';
      default: return '#6B7280';
    }
  };

  if (loading && orders.length === 0) {
    return <div className="loading">Loading orders...</div>;
  }

  return (
    <div className="orders-page">
      <div className="page-header">
        <h1>Order Management</h1>
        <div className="filters">
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
          >
            <option value="">All Orders</option>
            <option value="payment_pending">Payment Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="preparing">Preparing</option>
            <option value="out_for_delivery">Out for Delivery</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button onClick={fetchOrders} className="refresh-btn">Refresh</button>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Date</th>
              <th>Items</th>
              <th>Total</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>No orders found</td>
              </tr>
            ) : (
              orders.map(order => (
                <tr key={order.id}>
                  <td>
                    <span className="id-badge">#{order.id.slice(0, 8)}</span>
                  </td>
                  <td>{new Date(order.created_at).toLocaleString()}</td>
                  <td>
                    {order.items.map(item => (
                      <div key={item.product_id} style={{ fontSize: '0.85rem' }}>
                        {item.quantity}x {item.name}
                      </div>
                    ))}
                  </td>
                  <td>₹{order.total}</td>
                  <td>
                    <span style={{
                      padding: '4px 8px', 
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      backgroundColor: order.payment_status === 'paid' ? '#D1FAE5' : '#FEF3C7',
                      color: order.payment_status === 'paid' ? '#065F46' : '#92400E'
                    }}>
                      {order.payment_method.toUpperCase()} ({order.payment_status})
                    </span>
                  </td>
                  <td>
                    <span style={{
                      padding: '4px 8px', 
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      color: getStatusColor(order.status),
                      backgroundColor: `${getStatusColor(order.status)}20`
                    }}>
                      {order.status.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  </td>
                  <td>
                    {order.status !== 'cancelled' && order.status !== 'delivered' && (
                      <select 
                        className="action-select"
                        onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                        value=""
                        disabled={updating === order.id}
                      >
                        <option value="" disabled>Update Status...</option>
                        <option value="preparing">Mark Preparing</option>
                        <option value="picked_up">Mark Picked Up</option>
                        <option value="out_for_delivery">Mark Out for Delivery</option>
                        <option value="delivered">Mark Delivered</option>
                        <option value="cancelled">Cancel Order</option>
                      </select>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Orders;
