import express from 'express';
import Gallery from '../models/Gallery.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// @route   GET /api/gallery
// @desc    Get all gallery images
// @access  Public
router.get('/', async (req, res) => {
  try {
    const images = await Gallery.find().sort({ createdAt: -1 });
    res.json(images);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/gallery
// @desc    Add a new gallery image
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { url, alt, category } = req.body;
    if (!url) {
      return res.status(400).json({ message: 'Image URL is required' });
    }
    const newImage = new Gallery({ url, alt, category });
    const savedImage = await newImage.save();
    res.status(201).json(savedImage);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// @route   DELETE /api/gallery/:id
// @desc    Delete a gallery image
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const image = await Gallery.findById(req.params.id);
    if (!image) {
      return res.status(404).json({ message: 'Image not found' });
    }
    await image.deleteOne();
    res.json({ message: 'Image removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
