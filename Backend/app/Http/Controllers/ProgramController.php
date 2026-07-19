<?php

namespace App\Http\Controllers;

use App\Models\Program;
use Illuminate\Http\Request;
use App\Models\Instructor;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use App\Models\Section;


class ProgramController extends Controller
{
    


public function bulkUpload(Request $request) {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt',
        ]);

        $path = $request->file('file')->getRealPath();
        $rows = array_map('str_getcsv', file($path));

        // First row = header
        $header = array_map('trim', array_shift($rows));

        $inserted = [];
        $errors   = [];
        $sectionsCreated = 0;

        foreach ($rows as $i => $row) {
            $data = array_combine($header, $row);
            $data = array_map('trim', $data);

            // Basic validation
            $validator = Validator::make($data, [
                'name'      => 'required|string|max:255',
                'code'      => 'required|string|max:255',
                'yearLevel' => 'nullable|string',
                'category'  => 'required|string',
                'section'   => 'nullable|string',
            ]);

            if ($validator->fails()) {
                $errors[] = [
                    'row'    => $i + 2,
                    'errors' => $validator->errors()->all(),
                ];
                continue;
            }

            try {
                DB::beginTransaction();

                // Create program
                $program = Program::create([
                    'name'      => $data['name'],
                    'code'      => $data['code'],
                    'yearLevel' => $data['yearLevel'],
                    'category'  => ucwords(str_replace('_',' ',$data['category'])),
                ]);
                $inserted[] = $program;

                // Create section for non-Higher Education programs
                if (!empty($data['section']) && $data['category'] !== 'Higher Education') {
                    // Extract numeric value from year level (e.g., "Grade 4" -> 4)
                    $yearLevel = preg_replace('/[^0-9]/', '', $data['yearLevel']);
                    
                    // Create a unique section code that includes the year level and section
                    $sectionCode = $data['code'] . '-' . $yearLevel . '-' . $data['section'];
                    
                    // Create section
                    $section = Section::create([
                        'name' => $data['section'],
                        'code' => $sectionCode,
                        'year_level' => $yearLevel,
                        'category' => ucwords(str_replace('_',' ',$data['category'])),
                        'program_id' => $program->id
                    ]);
                    $sectionsCreated++;
                }

                DB::commit();
            } catch (\Exception $e) {
                DB::rollBack();
                $errors[] = [
                    'row' => $i + 2,
                    'errors' => [$e->getMessage()]
                ];
            }
        }

        return response()->json([
            'message'  => 'Programs upload complete',
            'inserted' => count($inserted),
            'sections_created' => $sectionsCreated,
            'errors'   => $errors,
        ], 201);
    }

    //  Retrieves all programs.
    public function index()
    {
        try {
            $programs = Program::with(['sections' => function($query) {
                $query->orderBy('year_level', 'asc')
                      ->orderBy('name', 'asc');
            }])->get();

            return response()->json(['programs' => $programs]);
        } catch (\Exception $e) {
            \Log::error('Error fetching programs: ' . $e->getMessage());
            return response()->json([
                'message' => 'Failed to fetch programs',
                'error' => $e->getMessage()
            ], 500);
        }
    }

   
    // Stores a new program if it doesn't already exist.
    public function store(Request $request)
    {
        try {
            DB::beginTransaction();

            // Get and validate the request data
            $validated = $request->validate([
                'name' => 'required|string',
                'code' => 'required|string',
                'yearLevel' => 'nullable|string',
                'category' => 'required|string',
                'section' => 'nullable|string',
            ]);

            // Get the category from validated data
            $category = $validated['category'];
            $code = $category === 'Intermediate' ? 'INT' : $validated['code'];

            // Check for existing program with the same name, code, and year level
            $existingProgram = Program::where(function($query) use ($validated, $code, $category) {
                $query->where('name', $validated['name'])
                      ->where(function($q) use ($code) {
                          $q->where('code', $code)
                            ->orWhere('code', $code === 'INT' ? 'Intermediate' : 'INT');
                      })
                      ->where('yearLevel', $validated['yearLevel'])
                      ->where('category', $category);
            })->first();

            if ($existingProgram) {
                // If program exists, check if we need to add a new section
                if (!empty($validated['section']) && $category !== 'Higher Education') {
                    $yearLevel = preg_replace('/[^0-9]/', '', $validated['yearLevel']);
                    $sectionCode = $code . '-' . $yearLevel . '-' . $validated['section'];
                    
                    $existingSection = Section::where('name', $validated['section'])
                                           ->where('code', $sectionCode)
                                           ->where('year_level', $yearLevel)
                                           ->first();

                    if (!$existingSection) {
                        $section = Section::create([
                            'name' => $validated['section'],
                            'code' => $sectionCode,
                            'year_level' => $yearLevel,
                            'category' => $category,
                            'program_id' => $existingProgram->id
                        ]);

                        DB::commit();
                        return response()->json([
                            'message' => 'Section added to existing program successfully',
                            'program' => $existingProgram->load('sections')
                        ], 200);
                    }
                }

                return response()->json([
                    'message' => 'Program with the same name already exists'
                ], 422);
            }

            // Create the new program
            $program = Program::create([
                'name' => $validated['name'],
                'code' => $code,
                'yearLevel' => $validated['yearLevel'],
                'category' => $category,
            ]);

            // Create section for non-Higher Education programs
            if (!empty($validated['section']) && $category !== 'Higher Education') {
                $yearLevel = preg_replace('/[^0-9]/', '', $validated['yearLevel']);
                $sectionCode = $code . '-' . $yearLevel . '-' . $validated['section'];
                
                Section::create([
                    'name' => $validated['section'],
                    'code' => $sectionCode,
                    'year_level' => $yearLevel,
                    'category' => $category,
                    'program_id' => $program->id
                ]);
            }

            DB::commit();

            return response()->json([
                'message' => 'Program created successfully',
                'program' => $program->load('sections')
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Error creating program: ' . $e->getMessage());
            \Log::error('Request data: ' . json_encode($request->all()));
            return response()->json([
                'message' => 'Failed to create program',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    
    // Retrieves the year levels of a program by its ID.
    public function getYearLevels($programId)
    {
        $program = Program::find($programId);

        if (!$program) {
            return response()->json(['message' => 'Program not found'], 404);
        }

        $yearLevels = $program->yearLevel;

        return response()->json($yearLevels);
    }

    
     // Displays a specific program with its levels.
    public function show($id)
    {
        $program = Program::with('levels')->findOrFail($id);
        return response()->json($program);
    }

    
    // Updates a specific program's details.
    
    public function update(Request $request, $id)
    {
        // Validate request data
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'code' => 'nullable|string|max:255',
            'yearLevel' => 'nullable|string',
            'category' => 'required|string'
        ]);

        // Normalize the category and code
        $category = ucwords(str_replace('_', ' ', $request->category));
        $code = $category === 'Intermediate' ? 'INT' : ($request->code ?? 'INT');

        // Find and update the program
        $program = Program::findOrFail($id);
        $program->update([
            'name' => $validated['name'],
            'code' => $code,
            'yearLevel' => $validated['yearLevel'],
            'category' => $category
        ]);

        return response()->json([
            'message' => 'Program updated successfully',
            'program' => $program 
        ]);
    }

     // Deletes a program.
    public function destroy($id)
    {
        $program = Program::findOrFail($id);
        $program->delete();

        return response()->json(['message' => 'Program deleted successfully']);
    }

   
     // Retrieves instructors assigned to a program by its code.
    public function getInstructorsByProgramCode($programCode)
    {
        try {
            // Get all programs with this code or its equivalent
            $programs = Program::where(function($query) use ($programCode) {
                $query->where('code', $programCode)
                      ->orWhere(function($q) use ($programCode) {
                          if ($programCode === 'INT') {
                              $q->where('code', 'Intermediate');
                          } else if ($programCode === 'Intermediate') {
                              $q->where('code', 'INT');
                          }
                      });
            })->get();
            
            if ($programs->isEmpty()) {
                \Log::info("No programs found for code: " . $programCode);
                return response()->json([]);
            }

            $programIds = $programs->pluck('id');

            // Get all instructor assignments for these programs, excluding soft-deleted instructors
            $instructorAssignments = DB::table('instructor_program')
                ->join('instructors', function($join) {
                    $join->on('instructor_program.instructor_id', '=', 'instructors.id')
                         ->whereNull('instructors.deleted_at');
                })
                ->join('programs', 'instructor_program.program_id', '=', 'programs.id')
                ->whereIn('instructor_program.program_id', $programIds)
                ->select(
                    'instructors.id',
                    'instructors.name',
                    'instructors.email',
                    'instructors.status',
                    'instructors.educationLevel',
                    'instructor_program.yearLevel',
                    'instructor_program.program_id',
                    'programs.name as program_name',
                    'programs.code as program_code'
                )
                ->get();

            \Log::info("Raw instructor assignments:", $instructorAssignments->toArray());

            // Group assignments by instructor
            $instructorGroups = $instructorAssignments->groupBy('id');

            // Transform the data to include all assignments
            $instructors = $instructorGroups->map(function ($assignments) {
                $firstAssignment = $assignments->first();
                
                // Create base instructor object
                $instructor = [
                    'id' => $firstAssignment->id,
                    'name' => $firstAssignment->name,
                    'email' => $firstAssignment->email,
                    'status' => $firstAssignment->status,
                    'educationLevel' => $firstAssignment->educationLevel,
                    'pivot' => [
                        'assignments' => $assignments->map(function ($assignment) {
                            return [
                                'yearLevel' => (int)$assignment->yearLevel,
                                'program_id' => $assignment->program_id,
                                'program_name' => $assignment->program_name,
                                'program_code' => $assignment->program_code
                            ];
                        })->values()->toArray()
                    ]
                ];
                
                \Log::info("Processing instructor assignments:", [
                    'instructor_id' => $firstAssignment->id,
                    'instructor_name' => $firstAssignment->name,
                    'assignments' => $instructor['pivot']['assignments']
                ]);
                
                return $instructor;
            })->values();

            \Log::info("Final instructors data:", $instructors->toArray());

            if ($instructors->isEmpty()) {
                return response()->json(['message' => 'No instructors assigned'], 200);
            }

            return response()->json($instructors);
        } catch (\Exception $e) {
            \Log::error("Error in getInstructorsByProgramCode: " . $e->getMessage());
            return response()->json(['error' => 'Failed to fetch instructors'], 500);
        }
    }

    // Retrieves programs based on category
    public function getProgramsByCategory($category)
    {
        $programs = Program::where('category', ucwords(str_replace('_', ' ', $category)))->get();

        if ($programs->isEmpty()) {
            return response()->json(['message' => 'No programs found for this category'], 404);
        }

        return response()->json($programs);
    }
    
    public function getInstructorResultsByProgram($code) {

        $program = Program::where('code', $code)->firstOrFail();

        $instructors = $program->instructors()->with(['evaluations.responses.question'])->get();

        $results = $instructors->map(function ($instructor) {
            $responses = $instructor->evaluations->flatMap->responses;

            $grouped = $responses->groupBy('question_id');

            $questionAverages = [];
            $totalSum = 0;
            $totalCount = 0;

            foreach ($grouped as $questionId => $responseGroup) {
                $ratingCounts = $responseGroup->groupBy('rating')->map->count();

                $sum = 0;
                $count = 0;
                foreach (range(1, 5) as $rating) {
                    $num = $ratingCounts->get($rating, 0);
                    $sum += $rating * $num;
                    $count += $num;
                }

                $average = $count > 0 ? $sum / $count : 0;
                $questionAverages[$questionId] = round($average, 2);

                $totalSum += $sum;
                $totalCount += $count;
            }

            $percentage = $totalCount > 0 ? ($totalSum / ($totalCount * 5)) * 100 : 0;

            $comments = $responses->pluck('comment')->filter()->unique()->values();

            return [
                'instructorId' => $instructor->id,
                'email' => $instructor->email,
                'name' => $instructor->name,
                'pivot' => [
                    'yearLevel' => $instructor->pivot->yearLevel,
                ],
                'ratings' => [
                    'q1' => $questionAverages[1] ?? null,
                    'q2' => $questionAverages[2] ?? null,
                    'q3' => $questionAverages[3] ?? null,
                    'q4' => $questionAverages[4] ?? null,
                    'q5' => $questionAverages[5] ?? null,
                    'q6' => $questionAverages[6] ?? null,
                    'q7' => $questionAverages[7] ?? null,
                    'q8' => $questionAverages[8] ?? null,
                    'q9' => $questionAverages[9] ?? null,
                ],
                'comments' => $comments->isEmpty() ? 'No comments' : $comments->join(', '),
                'overallRating' => round($percentage, 2),
            ];
        });

        return response()->json($results);
    }

    public function getFilteredInstructorResultsByProgram($code, Request $request) {
        $program = Program::where(function($query) use ($code) {
            $query->where('code', $code)
                  ->orWhere(function($q) use ($code) {
                      if ($code === 'INT') {
                          $q->where('code', 'Intermediate');
                      } else if ($code === 'Intermediate') {
                          $q->where('code', 'INT');
                      } else if ($code === 'JHS') {
                          $q->where('code', 'Junior High');
                      } else if ($code === 'Junior High') {
                          $q->where('code', 'JHS');
                      } else if ($code === 'SHS') {
                          $q->where('code', 'Senior High');
                      } else if ($code === 'Senior High') {
                          $q->where('code', 'SHS');
                      }
                  });
        })->firstOrFail();

        // Get all instructors assigned to this program
        $instructors = $program->instructors()
            ->with(['evaluations' => function($query) use ($request) {
                // Apply school year filter if provided
                if ($request->has('school_year') && $request->school_year) {
                    $query->where('school_year', $request->school_year);
                }
                
                // Apply semester filter if provided
                if ($request->has('semester') && $request->semester) {
                    $query->where('semester', $request->semester);
                }
                
                $query->with('responses.question');
            }])
            ->get();

        // Get all evaluations for these instructors, regardless of program
        $results = $instructors->map(function ($instructor) {
            // Get all evaluations for this instructor
            $responses = $instructor->evaluations->flatMap->responses;

            $grouped = $responses->groupBy('question_id');

            $questionAverages = [];
            $totalSum = 0;
            $totalCount = 0;

            foreach ($grouped as $questionId => $responseGroup) {
                $ratingCounts = $responseGroup->groupBy('rating')->map->count();

                $sum = 0;
                $count = 0;
                foreach (range(1, 5) as $rating) {
                    $num = $ratingCounts->get($rating, 0);
                    $sum += $rating * $num;
                    $count += $num;
                }

                $average = $count > 0 ? $sum / $count : 0;
                $questionAverages[$questionId] = round($average, 2);

                $totalSum += $sum;
                $totalCount += $count;
            }

            $percentage = $totalCount > 0 ? ($totalSum / ($totalCount * 5)) * 100 : 0;

            $comments = $responses->pluck('comment')->filter()->unique()->values();

            return [
                'id' => $instructor->id,
                'email' => $instructor->email,
                'name' => $instructor->name,
                'pivot' => [
                    'yearLevel' => $instructor->pivot->yearLevel,
                ],
                'ratings' => [
                    'q1' => $questionAverages[1] ?? null,
                    'q2' => $questionAverages[2] ?? null,
                    'q3' => $questionAverages[3] ?? null,
                    'q4' => $questionAverages[4] ?? null,
                    'q5' => $questionAverages[5] ?? null,
                    'q6' => $questionAverages[6] ?? null,
                    'q7' => $questionAverages[7] ?? null,
                    'q8' => $questionAverages[8] ?? null,
                    'q9' => $questionAverages[9] ?? null,
                ],
                'comments' => $comments->isEmpty() ? 'No comments' : $comments->join(', '),
                'overallRating' => round($percentage, 2),
            ];
        });

        return response()->json($results);
    }

    public function getYearLevelsByCode($code)
    {
        $programs = Program::where(function($query) use ($code) {
            $query->where('code', $code)
                  ->orWhere(function($q) use ($code) {
                      if ($code === 'INT') {
                          $q->where('code', 'Intermediate');
                      } else if ($code === 'Intermediate') {
                          $q->where('code', 'INT');
                      } else if ($code === 'JHS') {
                          $q->where('code', 'Junior High');
                      } else if ($code === 'Junior High') {
                          $q->where('code', 'JHS');
                      } else if ($code === 'SHS') {
                          $q->where('code', 'Senior High');
                      } else if ($code === 'Senior High') {
                          $q->where('code', 'SHS');
                      }
                  });
        })->get(['yearLevel']);

        $levels = $programs->pluck('yearLevel')
            ->filter()
            ->unique()
            ->map(function($level) {
                $number = preg_replace('/[^0-9]/', '', $level);
                return $number !== '' ? (int)$number : null;
            })
            ->filter()
            ->sort()
            ->values()
            ->all();

        return response()->json($levels);
    }

    public function getByCodeAndGrade($code, $gradeLevel)
    {
        try {
            $program = Program::where('code', $code)
                ->where('yearLevel', 'Grade ' . $gradeLevel)
                ->with('sections')
                ->first();

            if (!$program) {
                return response()->json(['message' => 'Program not found'], 404);
            }

            return response()->json($program);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to fetch program',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}