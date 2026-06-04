import Tutor from '../models/Tutor.js';

// @desc    Get all tutors
// @route   GET /api/tutors
// @access  Public
export const getTutors = async (req, res) => {
  try {
    const tutors = await Tutor.find({}).sort({ createdAt: -1 });
    res.json(tutors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create tutor profile
// @route   POST /api/tutors
// @access  Private (Admin)
export const createTutor = async (req, res) => {
  const { name, subject, qualification, experience, rating, board, image } = req.body;

  try {
    const tutor = await Tutor.create({
      name,
      subject,
      qualification,
      experience,
      rating: rating || '5.0',
      board,
      image
    });

    res.status(201).json(tutor);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update tutor profile
// @route   PUT /api/tutors/:id
// @access  Private (Admin)
export const updateTutor = async (req, res) => {
  const { name, subject, qualification, experience, rating, board, image } = req.body;

  try {
    const tutor = await Tutor.findById(req.params.id);

    if (tutor) {
      tutor.name = name || tutor.name;
      tutor.subject = subject || tutor.subject;
      tutor.qualification = qualification || tutor.qualification;
      tutor.experience = experience || tutor.experience;
      tutor.rating = rating || tutor.rating;
      tutor.board = board || tutor.board;
      tutor.image = image || tutor.image;

      const updatedTutor = await tutor.save();
      res.json(updatedTutor);
    } else {
      res.status(404).json({ message: 'Tutor not found' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete tutor profile
// @route   DELETE /api/tutors/:id
// @access  Private (Admin)
export const deleteTutor = async (req, res) => {
  try {
    const tutor = await Tutor.findById(req.params.id);

    if (tutor) {
      await tutor.deleteOne();
      res.json({ message: 'Tutor profile deleted' });
    } else {
      res.status(404).json({ message: 'Tutor not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
