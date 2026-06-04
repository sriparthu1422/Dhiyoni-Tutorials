import Newsletter from '../models/Newsletter.js';

// @desc    Subscribe email
// @route   POST /api/newsletters
// @access  Public
export const subscribeNewsletter = async (req, res) => {
  const { email } = req.body;

  try {
    // Check if already subscribed
    const exists = await Newsletter.findOne({ email });
    if (exists) {
      return res.status(400).json({ message: 'Email is already subscribed' });
    }

    const subscription = await Newsletter.create({ email });
    res.status(201).json(subscription);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get all subscribers
// @route   GET /api/newsletters
// @access  Private (Admin)
export const getNewsletters = async (req, res) => {
  try {
    const subscriptions = await Newsletter.find({}).sort({ createdAt: -1 });
    res.json(subscriptions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete subscriber
// @route   DELETE /api/newsletters/:id
// @access  Private (Admin)
export const deleteNewsletter = async (req, res) => {
  try {
    const subscription = await Newsletter.findById(req.params.id);

    if (subscription) {
      await subscription.deleteOne();
      res.json({ message: 'Subscription removed' });
    } else {
      res.status(404).json({ message: 'Subscription not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
