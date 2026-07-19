import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { toast } from "react-toastify";
import { Loader2 } from 'lucide-react';
import ProgramService from "../../../services/ProgramService";

export default function SeniorHighModal({ isOpen, onClose, onSave, isEditing, program }) {
  const [formData, setFormData] = useState({
    gradeLevel: "",
    section: ""
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [gradeLevelOptions, setGradeLevelOptions] = useState([]);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      fetchGradeLevels();
      
      if (isEditing && program) {
        const [gradeLevel, section] = program.name.split(' - ');
        setFormData({
          gradeLevel: gradeLevel.trim(),
          section: section ? section.trim() : ""
        });
      } else {
        setFormData({
          gradeLevel: "",
          section: ""
        });
      }

      return () => {};
    }
  }, [isOpen, isEditing, program]);

  const fetchGradeLevels = async () => {
    try {
      const levels = await ProgramService.getYearLevelsByCode("SHS");
      const sorted = levels
        .map(l => parseInt(l, 10))
        .filter(n => !isNaN(n))
        .sort((a, b) => a - b);
      const options = sorted.map(l => `Grade ${l}`);
      setGradeLevelOptions(options);
      if (options.length > 0 && !formData.gradeLevel) {
        setFormData(prev => ({ ...prev, gradeLevel: options[0] }));
      }
    } catch (error) {
      console.error("Error fetching grade levels:", error);
      setGradeLevelOptions(["Grade 11", "Grade 12"]);
    } finally {
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  };

  const handleGradeLevelChange = (value) => {
    setFormData(prev => ({
      ...prev,
      gradeLevel: value
    }));
  };

  const handleSectionChange = (value) => {
    setFormData(prev => ({
      ...prev,
      section: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate form
      if (!formData.gradeLevel) {
        toast.warning("Please select a grade level.");
        return;
      }

      if (!formData.section.trim()) {
        toast.warning("Please enter a section name.");
        return;
      }

      // Create program entry
      const programData = {
        name: `${formData.gradeLevel} - ${formData.section}`,
        code: "SHS",
        category: "Senior High",
        yearLevel: formData.gradeLevel,
        section: formData.section  // This is what the backend expects
      };

      console.log("Sending program data:", programData);
      const result = await onSave(programData, isEditing, program?.id);
      console.log("Save result:", result);
      onClose();
    } catch (error) {
      console.error("Error saving program:", error);
      toast.error("Failed to save program.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden relative"
      >
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm flex items-center justify-center z-10"
            >
              <div className="flex flex-col items-center gap-3">
                <motion.div
                  animate={{
                    scale: [1, 1.2, 1],
                    rotate: [0, 180, 360],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="w-12 h-12 border-4 border-[#1F3463] border-t-transparent rounded-full"
                />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  {isEditing ? "Loading program details..." : "Preparing form..."}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {isEditing ? "Edit Senior High" : "Add Senior High"}
          </h2>
          <button
            onClick={onClose}
            disabled={isLoading || isSubmitting}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-6">
            <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
              {/* Grade Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Grade Level
                </label>
                <select
                  value={formData.gradeLevel}
                  onChange={(e) => handleGradeLevelChange(e.target.value)}
                  disabled={isLoading || isSubmitting}
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                    focus:ring-2 focus:ring-[#1F3463] focus:border-transparent
                    text-gray-900 dark:text-gray-100
                    transition-all duration-200
                    hover:border-[#1F3463] dark:hover:border-[#1F3463]
                    cursor-pointer
                    disabled:opacity-50 disabled:cursor-not-allowed"
                  required
                >
                  <option value="">Select grade level</option>
                  {gradeLevelOptions.map((grade) => (
                    <option key={grade} value={grade}>{grade}</option>
                  ))}
                </select>
              </div>

              {/* Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Section/Strand
                </label>
                <input
                  type="text"
                  value={formData.section}
                  onChange={(e) => handleSectionChange(e.target.value)}
                  placeholder="Enter Section/Strand Name"
                  disabled={isLoading || isSubmitting}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl
                    focus:ring-2 focus:ring-[#1F3463] focus:border-transparent
                    placeholder-gray-400 dark:placeholder-gray-500
                    text-gray-900 dark:text-gray-100
                    transition-all duration-200
                    disabled:opacity-50 disabled:cursor-not-allowed"
                  required
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-4">
            <button
              type="submit"
              disabled={isLoading || isSubmitting}
              className="w-full px-4 py-3 bg-[#1F3463] text-white rounded-xl hover:bg-[#172a4d] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isEditing ? "Updating Program..." : "Adding Program..."}
                </>
              ) : (
                isEditing ? "Update Program" : "Add Program"
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
