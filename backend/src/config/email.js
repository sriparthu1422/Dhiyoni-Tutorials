import nodemailer from 'nodemailer';

export const sendTutorApplicationEmail = async (tutorDetails) => {
  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.EMAIL_PORT || '587');
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  const from = process.env.EMAIL_FROM || 'dhiyonitutorials.info@gmail.com';
  const to = process.env.EMAIL_TO || user;

  // Local development fallback: Log warning instead of failing the request
  if (!user || !pass) {
    console.warn('⚠️ SMTP Email credentials not configured in backend/.env. Email sending skipped.');
    return false;
  }

  // 1. Create nodemailer SMTP transporter
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for 587
    auth: {
      user,
      pass,
    },
  });

  // Convert DOB to reader-friendly format
  const dobFormatted = tutorDetails.dob 
    ? new Date(tutorDetails.dob).toLocaleDateString('en-IN', { dateStyle: 'long' }) 
    : 'Not Specified';

  // Join selected boards
  const boardsList = Array.isArray(tutorDetails.boards) && tutorDetails.boards.length > 0
    ? tutorDetails.boards.map(b => b.toUpperCase()).join(', ')
    : 'None Selected';

  // 2. Format details into a clean HTML email template matching Dhiyoni aesthetics
  const mailOptions = {
    from: `"DHIYONI Tutorials Web Portal" <${from}>`,
    to: to,
    subject: `New Tutor Application Submission: ${tutorDetails.fullName}`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1c1c; border: 1px solid #bfc8cd; border-radius: 16px; overflow: hidden; box-shadow: 0px 4px 12px rgba(0, 110, 140, 0.08);">
        <!-- Header -->
        <div style="background-color: #004e63; color: white; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 0.5px;">DHIYONI Tutorials</h1>
          <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">New Tutor Registration Request Received</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 24px; background-color: #ffffff;">
          <p style="font-size: 16px; line-height: 1.5; margin-bottom: 20px;">A new tutor candidate has submitted their application details. The application summary is listed below:</p>
          
          <h3 style="color: #00546c; font-size: 16px; border-bottom: 2px solid #00546c; padding-bottom: 6px; margin-top: 24px;">Personal Information</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px;">
            <tr style="background-color: #f9f9f9;">
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2; font-weight: bold; width: 35%;">Full Name</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2;">${tutorDetails.fullName}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2; font-weight: bold;">Gender</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2; text-transform: capitalize;">${tutorDetails.gender}</td>
            </tr>
            <tr style="background-color: #f9f9f9;">
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2; font-weight: bold;">Email ID</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2;"><a href="mailto:${tutorDetails.email}" style="color: #00546c; text-decoration: none; font-weight: bold;">${tutorDetails.email}</a></td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2; font-weight: bold;">Contact Number</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2; font-weight: bold;">${tutorDetails.contact}</td>
            </tr>
            <tr style="background-color: #f9f9f9;">
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2; font-weight: bold;">Date of Birth</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2;">${dobFormatted}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2; font-weight: bold;">Current Location</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2;">${tutorDetails.location}</td>
            </tr>
          </table>

          <h3 style="color: #00546c; font-size: 16px; border-bottom: 2px solid #00546c; padding-bottom: 6px; margin-top: 24px;">Academic & Expertise</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px;">
            <tr style="background-color: #f9f9f9;">
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2; font-weight: bold; width: 35%;">Qualification</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2;">${tutorDetails.qualification}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2; font-weight: bold;">Current Occupation</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2; text-transform: capitalize;">${tutorDetails.occupation}</td>
            </tr>
            <tr style="background-color: #f9f9f9;">
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2; font-weight: bold;">Grades to Teach</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2;">${tutorDetails.grades}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2; font-weight: bold;">Subjects to Handle</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2; color: #ae3100; font-weight: bold;">${tutorDetails.subjects}</td>
            </tr>
          </table>

          <h3 style="color: #00546c; font-size: 16px; border-bottom: 2px solid #00546c; padding-bottom: 6px; margin-top: 24px;">Logistics & Tools</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px;">
            <tr style="background-color: #f9f9f9;">
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2; font-weight: bold; width: 35%;">Preferred Time</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2;">${tutorDetails.time}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2; font-weight: bold;">Preferred Boards</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2;">${boardsList}</td>
            </tr>
            <tr style="background-color: #f9f9f9;">
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2; font-weight: bold;">Access to Laptop & Net</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2; font-weight: bold;">${tutorDetails.hasTech ? 'Yes' : 'No'}</td>
            </tr>
          </table>

          ${tutorDetails.experience ? `
            <h3 style="color: #00546c; font-size: 16px; border-bottom: 2px solid #00546c; padding-bottom: 6px; margin-top: 24px;">Teaching Experience</h3>
            <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; border: 1px solid #e2e2e2; font-size: 14px; line-height: 1.5; margin-top: 10px; white-space: pre-line;">
              ${tutorDetails.experience}
            </div>
          ` : ''}
          
        </div>

        <!-- Footer -->
        <div style="background-color: #f4f3f3; color: #6f787e; padding: 15px; font-size: 11px; text-align: center; border-top: 1px solid #e2e2e2;">
          <p style="margin: 0;">This email is an automatic notification generated from the DHIYONI Tutorials web registration portal.</p>
          <p style="margin: 4px 0 0 0;">Please access the Admin Dashboard to update status or schedule an interview.</p>
        </div>
      </div>
    `
  };

  // 3. Dispatch the message
  await transporter.sendMail(mailOptions);
  console.log(`📨 Application email forwarded to dhiyonitutorials.info@gmail.com successfully.`);
  return true;
};

export const sendParentSignupEmail = async (signupDetails) => {
  const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.EMAIL_PORT || '587');
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  const from = process.env.EMAIL_FROM || 'dhiyonitutorials.info@gmail.com';
  const to = process.env.EMAIL_TO || user;

  if (!user || !pass) {
    console.warn('⚠️ SMTP Email credentials not configured in backend/.env. Email sending skipped.');
    return false;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });

  const referralFormatted = signupDetails.referral 
    ? signupDetails.referral.replace(/_/g, ' ') 
    : 'None';

  const mailOptions = {
    from: `"DHIYONI Tutorials Web Portal" <${from}>`,
    to: to,
    subject: `New Student/Parent Signup Registration: ${signupDetails.studentName}`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1c1c; border: 1px solid #bfc8cd; border-radius: 16px; overflow: hidden; box-shadow: 0px 4px 12px rgba(0, 110, 140, 0.08);">
        <!-- Header -->
        <div style="background-color: #004e63; color: white; padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 0.5px;">DHIYONI Tutorials</h1>
          <p style="margin: 4px 0 0 0; font-size: 14px; opacity: 0.9;">New Student Enrollment Request Received</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 24px; background-color: #ffffff;">
          <p style="font-size: 16px; line-height: 1.5; margin-bottom: 20px;">A new student/parent enrollment registration request has been submitted. The summary is listed below:</p>
          
          <h3 style="color: #00546c; font-size: 16px; border-bottom: 2px solid #00546c; padding-bottom: 6px; margin-top: 24px;">Student Profile</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px;">
            <tr style="background-color: #f9f9f9;">
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2; font-weight: bold; width: 35%;">Student Name</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2;">${signupDetails.studentName}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2; font-weight: bold;">Gender</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2; text-transform: capitalize;">${signupDetails.gender || 'Not Specified'}</td>
            </tr>
            <tr style="background-color: #f9f9f9;">
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2; font-weight: bold;">Grade / Class</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2;">${signupDetails.grade}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2; font-weight: bold;">Subject Required</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2; color: #ae3100; font-weight: bold;">${signupDetails.subject}</td>
            </tr>
          </table>

          <h3 style="color: #00546c; font-size: 16px; border-bottom: 2px solid #00546c; padding-bottom: 6px; margin-top: 24px;">Parent Contact Details</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 14px;">
            <tr style="background-color: #f9f9f9;">
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2; font-weight: bold; width: 35%;">Parent Name</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2;">${signupDetails.parentName}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2; font-weight: bold;">Contact Number</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2; font-weight: bold;">${signupDetails.contact}</td>
            </tr>
            <tr style="background-color: #f9f9f9;">
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2; font-weight: bold;">Email ID</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2;"><a href="mailto:${signupDetails.email}" style="color: #00546c; text-decoration: none; font-weight: bold;">${signupDetails.email}</a></td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2; font-weight: bold;">Location</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2;">${signupDetails.city}, ${signupDetails.state}</td>
            </tr>
            <tr style="background-color: #f9f9f9;">
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2; font-weight: bold;">Referral Source</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e2e2; text-transform: capitalize;">${referralFormatted}</td>
            </tr>
          </table>
          
        </div>

        <!-- Footer -->
        <div style="background-color: #f4f3f3; color: #6f787e; padding: 15px; font-size: 11px; text-align: center; border-top: 1px solid #e2e2e2;">
          <p style="margin: 0;">This email is an automatic notification generated from the DHIYONI Tutorials web registration portal.</p>
          <p style="margin: 4px 0 0 0;">Please access the Admin Dashboard to review student registration lists.</p>
        </div>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
  console.log(`📨 Student/Parent signup email forwarded to dhiyonitutorials.info@gmail.com successfully.`);
  return true;
};

