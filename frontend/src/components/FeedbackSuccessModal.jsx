import React from 'react';

export default function FeedbackSuccessModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 transform transition-all flex flex-col items-center text-center animate-fade-in-up">
        {/* Success Icon */}
        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
          <span className="material-symbols-outlined text-[48px]">check_circle</span>
        </div>
        
        <h2 className="font-montserrat font-bold text-headline-sm md:text-headline-md text-primary mb-4">
          🎉 Feedback Submitted Successfully!
        </h2>
        
        <div className="font-inter text-body-md text-on-surface-variant space-y-4 mb-8">
          <p>Thank you for sharing your feedback with us.</p>
          <p>Your feedback is very important to us and helps us improve our services and learning experience.</p>
          <p>We appreciate your time and support.</p>
          <p className="font-semibold text-primary">Thank You!</p>
        </div>
        
        <button
          onClick={onClose}
          className="w-full py-3 bg-primary text-white font-bold rounded-xl hover:bg-primary-container transition-colors shadow-md"
        >
          OK
        </button>
      </div>
    </div>
  );
}
