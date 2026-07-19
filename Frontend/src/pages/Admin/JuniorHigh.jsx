import React, { useState, useEffect } from "react";
import InstructorTable from "../../contents/Admin/InstructorTable";
import Tabs from "../../components/Tabs";
import ContentHeader from "../../contents/Admin/ContentHeader";
import ProgramService from "../../services/ProgramService";
import EvaluationService from "../../services/EvaluationService";
import EvaluationFilterService from "../../services/EvaluationFilterService";
import InstructorService from "../../services/InstructorService";
import { toast, ToastContainer } from "react-toastify";
import FullScreenLoader from "../../components/FullScreenLoader";
import { useLoading } from "../../components/LoadingContext";
import { Users, UserX, Loader2 } from "lucide-react";
import { validateGradeLevel } from "../../utils/gradeLevelFormatter.jsx";
import SectionModal from '../../contents/Admin/Modals/SectionModal';
import { FaPlus } from 'react-icons/fa';
import SectionService from "../../services/SectionService";
import BulkSendModal from "../../components/BulkSendModal";

function JuniorHigh() {
  const [activeTab, setActiveTab] = useState(0);
  const [mergedInstructorsByGrade, setMergedInstructorsByGrade] = useState([]);
  const [noInstructors, setNoInstructors] = useState(false);
  const [submittedCount, setSubmittedCount] = useState(0);
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkSendStatus, setBulkSendStatus] = useState(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState(null);
  const [sections, setSections] = useState([]);
  const [activeSection, setActiveSection] = useState("Section A");
  const [filters, setFilters] = useState({
    schoolYear: '',
    semester: '',
    searchQuery: ''
  });
  const [gradeLevels, setGradeLevels] = useState([]);
  const [tabLabels, setTabLabels] = useState([]);

  const programCode = "JHS";
  const { loading, setLoading } = useLoading();

  const schoolYearOptions = EvaluationFilterService.getSchoolYearOptions();
  const semesterOptions = EvaluationFilterService.getSemesterOptions();

  useEffect(() => {
    const fetchGradeLevels = async () => {
      try {
        const levels = await ProgramService.getYearLevelsByCode(programCode);
        const sorted = levels
          .map(l => parseInt(l, 10))
          .filter(n => !isNaN(n))
          .sort((a, b) => a - b);
        setGradeLevels(sorted);
        setTabLabels(sorted.map(l => `Grade ${l}`));
        setMergedInstructorsByGrade(new Array(sorted.length).fill([]));
      } catch (error) {
        console.error("Error fetching grade levels:", error);
        setGradeLevels([]);
        setTabLabels([]);
      }
    };
    fetchGradeLevels();
  }, [programCode]);

  useEffect(() => {
    fetchSections();
  }, [activeTab]);

  const handleFilterChange = (filterType, value) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: value
    }));
  };

  const handleSearch = (query) => {
    handleFilterChange('searchQuery', query);
  };

  const handleExport = () => {
    console.log("Export to PDF");
  };

  const handleAddInstructor = () => {
    console.log("Add Instructor");
  };

  const handleManageSections = (gradeLevel) => {
    setSelectedGrade(gradeLevel);
    setShowSectionModal(true);
  };

  const filterInstructors = (instructors, query) => {
    if (!query) return instructors;
    return instructors.filter(instructor =>
      instructor.name.toLowerCase().includes(query.toLowerCase()) ||
      instructor.email.toLowerCase().includes(query.toLowerCase())
    );
  };

  const handleBulkSend = async (selectedInstructorIds) => {
    setBulkSending(true);
    try {
      if (selectedInstructorIds.length === 0) {
        toast.warning("No instructors selected");
        setBulkSending(false);
        setShowConfirmModal(false);
        return;
      }

      const response = await InstructorService.sendBulkResults(programCode, {
        instructorIds: selectedInstructorIds
      });
      
      setBulkSendStatus(response);
      toast.success(
        `Successfully sent results to ${response.sent_count} instructors`,
        { autoClose: 5000 }
      );
      
      if (response.failed_count > 0) {
        toast.warning(
          `Failed to send to ${response.failed_count} instructors`,
          { autoClose: 7000 }
        );
        console.log("Failed emails:", response.failed_emails);
      }
    } catch (err) {
      console.error("Bulk send error:", err);
      toast.error(
        err.message || "Failed to perform bulk send operation",
        { autoClose: 5000 }
      );
    } finally {
      setBulkSending(false);
      setShowConfirmModal(false);
    }
  };

  const fetchSections = async () => {
    try {
      const response = await SectionService.getByGradeAndCategory(activeTab + 7, "Junior High");
      setSections(response);
    } catch (error) {
      console.error("Error fetching sections:", error);
      toast.error("Failed to load sections");
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [filteredResults, courseEvalCounts] = await Promise.all([
        EvaluationFilterService.getFilteredResults(programCode, {
          schoolYear: filters.schoolYear,
          semester: filters.semester
        }),
        EvaluationService.getCourseEvaluationSubmissionCounts(),
      ]);

      if (!Array.isArray(filteredResults) || !Array.isArray(courseEvalCounts)) {
        throw new Error("Invalid data format received from one or more endpoints");
      }

      // Calculate total submitted count from the data
      const totalSubmitted = courseEvalCounts.reduce((total, course) => {
        if (course.program_code === programCode) {
          return total + (course.submitted || 0);
        }
        return total;
      }, 0);

      setSubmittedCount(totalSubmitted);

      const instructorsData = await ProgramService.getInstructorsByProgramCode(programCode);
      
      if (!Array.isArray(instructorsData)) {
        throw new Error("Invalid instructors data format received");
      }

      const groupByGrade = (data) => {
        const grouped = gradeLevels.map(() => []);
        
        data.forEach((item) => {
          if (!item || !item.pivot || !Array.isArray(item.pivot.assignments)) {
            console.log('Invalid item data:', item);
            return;
          }

          item.pivot.assignments.forEach((assignment) => {
            const yearLevel = parseInt(assignment.yearLevel, 10);
            console.log(`Processing assignment for ${item.name}:`, {
              yearLevel,
              assignment: JSON.stringify(assignment, null, 2)
            });
            
            if (isNaN(yearLevel)) {
              console.log(`Invalid year level for instructor ${item.name}:`, yearLevel);
              return;
            }

            const gradeIndex = gradeLevels.indexOf(yearLevel);
            if (gradeIndex === -1) {
              console.log(`Year level ${yearLevel} not in active grade levels for instructor ${item.name}`);
              return;
            }

            const instructor = {
              id: item.id,
              name: item.name,
              email: item.email,
              status: item.status,
              educationLevel: item.educationLevel,
              gradeLevel: yearLevel,
              section: assignment.program_name.split(' - ')[1] || 'No Section',
              program: assignment.program_name || `Grade ${yearLevel}`,
              pivot: {
                yearLevel: yearLevel,
                program_id: assignment.program_id,
                program_name: assignment.program_name || `Grade ${yearLevel}`,
                section: assignment.program_name.split(' - ')[1] || 'No Section'
              },
              ratings: item.ratings || {
                q1: null,
                q2: null,
                q3: null,
                q4: null,
                q5: null,
                q6: null,
                q7: null,
                q8: null,
                q9: null
              },
              comments: item.comments || "No comments",
              overallRating: item.overallRating || 0
            };

            grouped[gradeIndex].push(instructor);
          });
        });

        // Sort each grade group by section
        grouped.forEach(gradeGroup => {
          gradeGroup.sort((a, b) => {
            if (a.section === b.section) return 0;
            if (a.section === 'No Section') return 1;
            if (b.section === 'No Section') return -1;
            return a.section.localeCompare(b.section);
          });
        });

        return grouped;
      };

      // Merge instructors with filtered results
      const merged = instructorsData.map(instructor => {
        const result = filteredResults.find(r => r.id === instructor.id || r.name === instructor.name) || {};
        // Initialize default values for ratings and comments if not present
        const defaultRatings = {
          q1: null, q2: null, q3: null, q4: null, q5: null,
          q6: null, q7: null, q8: null, q9: null
        };
        
        return { 
          ...instructor,
          ...result,
          ratings: result.ratings || defaultRatings,
          comments: result.comments || "No comments",
          overallRating: result.overallRating || 0,
          pivot: instructor.pivot
        };
      });

      console.log("Merged Data before Grouping:", JSON.stringify(merged, null, 2));

      const mergedGrouped = groupByGrade(merged);

      console.log("Merged Data after Grouping:", mergedGrouped);

      // Apply search filter
      const filteredMerged = mergedGrouped.map(gradeGroup =>
        filterInstructors(gradeGroup, filters.searchQuery)
      );

      setMergedInstructorsByGrade(filteredMerged);
      setNoInstructors(instructorsData.length === 0);
    } catch (error) {
      console.error("Data fetch failed:", error);
      setNoInstructors(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (gradeLevels.length > 0) {
      fetchData();
    }
  }, [programCode, filters.schoolYear, filters.semester, gradeLevels]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 500);

    return () => clearTimeout(timer);
  }, [filters.searchQuery]);

  useEffect(() => {
    fetchSections();
  }, [activeTab]);

  const hasInstructorsForGrade = (index) => {
    return mergedInstructorsByGrade[index]?.length > 0;
  };

  const hasInstructorsAssigned = () => {
    return mergedInstructorsByGrade.some((gradeGroup) => gradeGroup.length > 0);
  };

  const filteredInstructors = (mergedInstructorsByGrade[activeTab] || []).filter(instructor => {
    // For all grade levels, filter by section if sections exist
    if (sections.length > 0) {
      // Extract section from program name
      const sectionMatch = instructor.program?.match(/Section ([A-Z])/);
      const instructorSection = sectionMatch ? `Section ${sectionMatch[1]}` : 'No Section';
      return instructorSection === activeSection;
    }
    return true;
  });

  console.log(`Grade ${activeTab + 7} filtered instructors:`, {
    totalInstructors: (mergedInstructorsByGrade[activeTab] || []).length,
    filteredCount: filteredInstructors.length,
    activeSection: activeSection,
    sections: sections.map(s => s.name)
  });

  return (
    <main className="p-4 bg-white dark:bg-gray-900 min-h-screen">
      <ToastContainer position="top-right" autoClose={3000} />
      {loading ? (
        <FullScreenLoader />
      ) : (
        <>
          <ContentHeader
            title="Instructors"
            stats={[`Submitted: ${submittedCount}`]}
            onSearch={handleSearch}
            onExport={handleExport}
            onAdd={handleAddInstructor}
            onBulkSend={() => setShowConfirmModal(true)}
            onSchoolYearChange={(value) => handleFilterChange('schoolYear', value)}
            onSemesterChange={(value) => handleFilterChange('semester', value)}
            selectedSchoolYear={filters.schoolYear}
            selectedSemester={filters.semester}
            schoolYearOptions={schoolYearOptions}
            semesterOptions={semesterOptions}
          />

          <div className="flex justify-between items-center mb-4">
            {tabLabels.length > 0 ? (
              <Tabs tabs={tabLabels} activeTab={activeTab} setActiveTab={setActiveTab} />
            ) : (
              <div className="text-gray-500 dark:text-gray-400 text-sm">
                No Grade Levels Available
              </div>
            )}
            {tabLabels.length > 0 && (
              <button
                onClick={() => handleManageSections(gradeLevels[activeTab])}
                className="px-4 py-2 bg-[#1F3463] text-white rounded-lg hover:bg-[#172a4d] flex items-center gap-2"
              >
                <FaPlus className="w-4 h-4" />
                Manage Sections
              </button>
            )}
          </div>

          {tabLabels.length > 0 ? (
            <>
              {/* Section Tabs for all Grades */}
              <div className="bg-gray-50 dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 mb-4">
                {sections.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {sections.map((section) => (
                      <button
                        key={section.id}
                        onClick={() => setActiveSection(section.name)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          activeSection === section.name
                            ? "bg-[#1F3463] text-white"
                            : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                        }`}
                      >
                        {section.name}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6">
                    <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-full mb-4">
                      <UserX className="w-8 h-8 text-gray-500 dark:text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                      No Sections Available
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 text-center mb-4">
                      {`No sections are currently set up for ${tabLabels[activeTab]}.`}
                    </p>
                    <button
                      onClick={() => handleManageSections(gradeLevels[activeTab])}
                      className="px-4 py-2 bg-[#1F3463] text-white rounded-lg hover:bg-[#172a4d] flex items-center gap-2"
                    >
                      <FaPlus className="w-4 h-4" />
                      Add Section
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-4 text-center">
                {sections.length > 0 ? (
                  hasInstructorsForGrade(activeTab) && filteredInstructors.length > 0 ? (
                    <InstructorTable 
                      instructors={filteredInstructors} 
                      gradeLevel={gradeLevels[activeTab]}
                      category="Junior High"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 px-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-full mb-4">
                        <UserX className="w-8 h-8 text-gray-500 dark:text-gray-400" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                        No Instructors in Section
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400 text-center">
                        {`No instructors are currently assigned to ${activeSection} for ${tabLabels[activeTab]}.`}
                      </p>
                    </div>
                  )
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-full mb-4">
                <Users className="w-12 h-12 text-gray-500 dark:text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                No Grade Levels Created
              </h3>
              <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
                No grade levels have been set up for Junior High yet. Add grade levels in the Programs page to see instructors here.
              </p>
            </div>
          )}
        </>
      )}

      {/* Section Management Modal */}
      <SectionModal
        isOpen={showSectionModal}
        onClose={() => setShowSectionModal(false)}
        gradeLevel={selectedGrade}
        category="Junior High"
        onSave={() => {
          setShowSectionModal(false);
          fetchData();
          fetchSections();
        }}
      />

      {/* Bulk Send Modal */}
      <BulkSendModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={(selectedInstructorIds) => handleBulkSend(selectedInstructorIds)}
        programCode={programCode}
        instructors={mergedInstructorsByGrade.flat()}
        isSending={bulkSending}
        showLoadingOverlay={bulkSending}
      />
    </main>
  );
}

export default JuniorHigh;
