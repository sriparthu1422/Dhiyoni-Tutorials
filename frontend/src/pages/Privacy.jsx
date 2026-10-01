import React from 'react'
import SEO from '../components/SEO'

export default function Privacy() {
  return (
    <>
      <SEO title="Privacy Policy" description="Privacy Policy for Dhiyoni Tutorials" />
      <div className="section-container py-12 md:py-20">
        <h1 className="text-display-md font-montserrat font-bold text-primary mb-8">Privacy Policy</h1>
        <div className="prose prose-slate max-w-none text-on-surface">
          <p>Last updated: October 2026</p>
          <h2>1. Introduction</h2>
          <p>At Dhiyoni Tutorials, we respect your privacy and are committed to protecting your personal data. This privacy policy will inform you as to how we look after your personal data when you visit our website and tell you about your privacy rights and how the law protects you.</p>
          
          <h2>2. The Data We Collect About You</h2>
          <p>We may collect, use, store and transfer different kinds of personal data about you which we have grouped together as follows:</p>
          <ul>
            <li><strong>Identity Data</strong> includes first name, last name, username or similar identifier.</li>
            <li><strong>Contact Data</strong> includes billing address, email address and telephone numbers.</li>
            <li><strong>Technical Data</strong> includes internet protocol (IP) address, your login data, browser type and version, time zone setting and location.</li>
          </ul>

          <h2>3. How We Use Your Personal Data</h2>
          <p>We will only use your personal data when the law allows us to. Most commonly, we will use your personal data in the following circumstances:</p>
          <ul>
            <li>Where we need to perform the contract we are about to enter into or have entered into with you (e.g., matching you with a tutor).</li>
            <li>Where it is necessary for our legitimate interests (or those of a third party) and your interests and fundamental rights do not override those interests.</li>
            <li>Where we need to comply with a legal obligation.</li>
          </ul>

          <h2>4. Data Security</h2>
          <p>We have put in place appropriate security measures to prevent your personal data from being accidentally lost, used or accessed in an unauthorised way, altered or disclosed.</p>
          
          <h2>5. Contact Us</h2>
          <p>If you have any questions about this privacy policy or our privacy practices, please contact us via our Contact page.</p>
        </div>
      </div>
    </>
  )
}
