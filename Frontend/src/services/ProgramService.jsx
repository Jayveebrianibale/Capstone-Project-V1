import api from "../services/api";

const ProgramService = {
  getAll: async () => {
    const response = await api.get("/programs");
    return response.data;
  },

  create: async (data) => {
    try {
      console.log("Sending Program Data:", JSON.stringify(data, null, 2));
      const response = await api.post("/programs", data);
      console.log("Program Created:", response.data);
      return response.data;
    } catch (error) {
      console.error("Error creating program:", error.response?.data || error.message);
      throw {
        ...error,
        response: {
          ...error.response,
          data: error.response?.data || { message: "Failed to create program" }
        }
      };
    }
  },

  update: async (id, data) => {
    const response = await api.put(`/programs/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    console.log(`Deleting Program ID: ${id}`);
    const response = await api.delete(`/programs/${id}`);
    console.log("Program Deleted:", response.data);
    return response.data;
  },

  getInstructorsByProgramCode: async (code) => {
    const response = await api.get(`/programs/${code}/instructors`);
    return response.data;
  },

  getYearLevels: async (id) => {
    const response = await api.get(`/programs/${id}/year-levels`);
    return response.data;
  },

  getInstructorResultsByProgram: async (code) => {
    const response = await api.get(`/programs/${code}/instructor-results`);
    return response.data;
  },

  bulkUpload: async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await api.post("/programs/bulk-upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    console.log("Bulk Upload Response:", response.data);
    return response.data;
  },

  getByCodeAndCategory: async (code, gradeLevel) => {
    try {
      const response = await api.get(`/programs/code/${code}/grade/${gradeLevel}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching program by code and category:', error);
      throw error;
    }
  },

  getYearLevelsByCode: async (code) => {
    const response = await api.get(`/programs/levels/${code}`);
    return response.data;
  },
};

export default ProgramService;