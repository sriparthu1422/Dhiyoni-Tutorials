import User from '../models/User.js';
import Tutor from '../models/Tutor.js';

const seedData = async () => {
  try {
    // 1. Seed Admin User
    const adminExists = await User.findOne({ email: 'admin@dhiyoni.com' });
    if (!adminExists) {
      await User.create({
        username: 'DHIYONI Admin',
        email: 'admin@dhiyoni.com',
        password: 'DhiyoniAdmin2026!', // Will be automatically hashed in pre-save hook
        role: 'admin'
      });
      console.log('Admin user seeded successfully!');
    }

    // 2. Seed Initial Tutors
    const tutorsCount = await Tutor.countDocuments();
    if (tutorsCount === 0) {
      const initialTutors = [
        {
          name: 'Dr. Anita Sharma',
          subject: 'Mathematics',
          qualification: 'M.Sc, Ph.D in Maths',
          experience: '12+ Years',
          rating: '4.9',
          board: 'CBSE & ICSE',
          image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCM5oyIoXXLAK34szcdBhhbbSUIelhHhtp8Gyc-ABppMVppF7f1QHdI6DrL5fY5S5eLNYF6qHKRCqCxWVf398g6OJOLTwBTTnSVNM23qXA4G9ZDevwhzJHsO1tf9p3dGlJm6916yVnFoeom8MH4FiiGrAHvKBgpVjjbS1YVr7r0XKm3m72sZobh-7Eg3mjw62vnBhmxsDOxfdBJLPL4w5b1Q_YRH9V-nv6qtfgSuxyWzEK0jXEa4m35GJZqmSy20s7BXDs_9S9Vb396'
        },
        {
          name: 'Prof. Rajesh Iyer',
          subject: 'Physics',
          qualification: 'M.Tech, B.Ed',
          experience: '15+ Years',
          rating: '5.0',
          board: 'State Board',
          image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAWhjmkToOEY-HXI-kOZQnqPdvczr6YRVZF-v9gqGMZuiD646tmWFavKZYxHHpsAmZgF7I39wW65nIgVJP9kEl0h4rOFHV-L-8B3xYp0_p_8jycytSIOJ2_4CbGkrqvyFDZQAz3pOTQTO4npEzazUMruikThzyHdrd2RVx0OE8eYGcyozBTPjq9ml448t7dfjhwvemiwcD08Qk01KuBg48e7Sj-XTmOyFbc2h9d70SrBLWyPimx9rGAd_s489EKr-rdhChjALE5IP3y'
        },
        {
          name: 'Ms. Priya Verma',
          subject: 'Biology',
          qualification: 'M.Sc Biology',
          experience: '8+ Years',
          rating: '4.8',
          board: 'ICSE & CBSE',
          image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCpK-nsv0LMutInjLcE1AyNfcXsYM77ewslUUMajzfFrOIPuNYVYFb3lPGo35JgN_xqfQcLYBXWZjHmkz-JCefn1n4Oc7xyCdQWsX9Jhsn_UoRIT28cJoyaC6eHXcNAAXVI2RsxbQ9n0MavR6Q7BPhAw2Nf8wS2rM2QVxsUOj0E6lh-QncDy6lLK3DfjP0tiTfmVlDDfo3TexstzMziC596m2Ls6tHNYRraCK6VngCW5EMVHPq2K9Tn2ciqN9jEFavs3B0euqIlJyQP'
        },
        {
          name: 'Mr. Sanjay Kapur',
          subject: 'Chemistry',
          qualification: 'M.Sc Chemistry, NET',
          experience: '10+ Years',
          rating: '4.9',
          board: 'All Boards',
          image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDY4rItZaBA0p4aMnwqJ8FF1pfdQolcLwnvR85dZYqmByRHxNsTt-x4KyHax8noqtJ_vPE6O7hFBPfRH6zemMhq8HRr8DtLPLB-TI4ypk9lBOLAM6OYWo2h42NhSnXWhe1Fx0lodmi7U4Q7llPuT2BvPShZpp-ita4o9Nr14lzw-CoAQBOPc_1YTjuVNLPjAyQAIQSGBAXg6FQbalTwIGsgYpowqfM_x8gzFjlNZyPrqs9PjWFCBjO87_zDH-dc_KmMLq1VyQ_Fulz'
        }
      ];

      await Tutor.insertMany(initialTutors);
      console.log('Initial tutors seeded successfully!');
    }
  } catch (error) {
    console.error(`Seeding error: ${error.message}`);
  }
};

export default seedData;
