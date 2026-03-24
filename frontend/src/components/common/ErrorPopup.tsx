import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useLabStore } from '../../store/useLabStore';

export default function ErrorPopup() {
  const { validationError, clearValidationError } = useLabStore();
  const modalRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (validationError && modalRef.current && backdropRef.current) {
      // Animate in with a spring/bounce effect
      gsap.fromTo(backdropRef.current, 
        { opacity: 0 }, 
        { opacity: 1, duration: 0.3 }
      );
      gsap.fromTo(modalRef.current,
        { scale: 0.8, opacity: 0, y: 50 },
        { scale: 1, opacity: 1, y: 0, duration: 0.5, ease: 'back.out(1.7)' }
      );
    }
  }, [validationError]);

  if (!validationError) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Semi-transparent backdrop */}
      <div 
        ref={backdropRef}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={clearValidationError}
      />
      
      {/* Modal */}
      <div 
        ref={modalRef}
        className="relative bg-[#0a1128] border border-gray-700 p-6 rounded-xl shadow-2xl max-w-[440px] w-full mx-4"
      >
        <h2 className="text-xl font-bold text-red-400 mb-3 border-b border-red-500/30 pb-2">
          {validationError.title}
        </h2>
        
        <p className="text-gray-300 mb-5 leading-relaxed">
          {validationError.reason}
        </p>

        <div className="bg-cyan-900/20 border border-cyan-500/30 p-4 rounded-lg mb-6">
          <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider mb-1">
            Correct next step
          </div>
          <div className="text-cyan-50 font-medium">
            {validationError.nextStep}
          </div>
        </div>

        <button 
          onClick={clearValidationError}
          className="w-full py-3 bg-gradient-to-r from-red-500/20 to-orange-500/20 hover:from-red-500/30 hover:to-orange-500/30 text-white font-bold rounded shadow-lg border border-red-500/50 transition-all active:scale-95"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
