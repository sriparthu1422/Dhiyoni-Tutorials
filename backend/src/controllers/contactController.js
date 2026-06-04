import Contact from '../models/Contact.js';

// @desc    Create contact inquiry
// @route   POST /api/contacts
// @access  Public
export const createContact = async (req, res) => {
  const { name, email, subject, message } = req.body;

  try {
    const contact = await Contact.create({
      name,
      email,
      subject,
      message
    });

    res.status(201).json(contact);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get all inquiries
// @route   GET /api/contacts
// @access  Private (Admin)
export const getContacts = async (req, res) => {
  try {
    const contacts = await Contact.find({}).sort({ createdAt: -1 });
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update inquiry status
// @route   PUT /api/contacts/:id
// @access  Private (Admin)
export const updateContactStatus = async (req, res) => {
  const { status } = req.body;

  try {
    const contact = await Contact.findById(req.params.id);

    if (contact) {
      contact.status = status || contact.status;
      const updatedContact = await contact.save();
      res.json(updatedContact);
    } else {
      res.status(404).json({ message: 'Inquiry not found' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete contact inquiry
// @route   DELETE /api/contacts/:id
// @access  Private (Admin)
export const deleteContact = async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);

    if (contact) {
      await contact.deleteOne();
      res.json({ message: 'Inquiry deleted' });
    } else {
      res.status(404).json({ message: 'Inquiry not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
