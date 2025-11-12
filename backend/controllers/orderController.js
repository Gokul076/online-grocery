const Order = require('../model/order');
const Product = require('../model/product');

exports.listOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

exports.createOrder = async (req, res) => {
  try {
    const { orderId, customerName, customerEmail, total, items, paid } = req.body;
    // Validate items
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ msg: 'No items provided' });

    // Pre-check stock availability
    for (const it of items) {
      const prod = await Product.findById(it.productId);
      if (!prod) return res.status(400).json({ msg: `Product not found: ${it.productId}` });
      if (typeof prod.stock === 'number' && prod.stock < Number(it.quantity)) {
        return res.status(400).json({ msg: `Insufficient stock for product ${prod.name}` });
      }
    }

    // Decrement stock for each item
    for (const it of items) {
      await Product.findByIdAndUpdate(it.productId, { $inc: { stock: -Math.max(0, Number(it.quantity) || 0) } });
    }

    const status = paid ? 'paid' : 'pending';
    const o = new Order({ orderId, customerName, customerEmail, total, items, status });
    await o.save();
    res.status(201).json(o);
  } catch (err) {
    console.error('[API] Error creating order:', err);
    res.status(400).json({ msg: 'Invalid data', error: err.message });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params; // Mongo _id
    const { status } = req.body;
    const o = await Order.findByIdAndUpdate(id, { status }, { new: true });
    if (!o) return res.status(404).json({ msg: 'Not found' });
    res.json(o);
  } catch (err) {
    res.status(400).json({ msg: 'Invalid data' });
  }
};

exports.assignOrder = async (req, res) => {
  try {
    const { id } = req.params; // Mongo _id
    const { assignedTo } = req.body; // email
    const o = await Order.findById(id);
    if (!o) return res.status(404).json({ msg: 'Not found' });
    o.assignedTo = assignedTo || null;
    if (o.status === 'paid' && assignedTo) o.status = 'shipped';
    await o.save();
    res.json(o);
  } catch (err) {
    res.status(400).json({ msg: 'Invalid data' });
  }
};




