import sqlite3
import random
from datetime import date, timedelta

# ============================================================
# CONFIGURATION
# ============================================================

DB_NAME = "student_erp.db"

NUM_STUDENTS = 3000
NUM_FACULTY = 150
NUM_COURSES_PER_DEPT = 15

random.seed(42)


# ============================================================
# DATABASE CONNECTION
# ============================================================

conn = sqlite3.connect(DB_NAME)
cursor = conn.cursor()

cursor.execute("PRAGMA foreign_keys = ON;")


# ============================================================
# DROP EXISTING TABLES
# ============================================================

tables = [
    "notifications",
    "leave_requests",
    "hostel_allocations",
    "scholarships",
    "fees",
    "exam_results",
    "exams",
    "assignment_submissions",
    "assignments",
    "internal_marks",
    "attendance",
    "enrollments",
    "course_offerings",
    "timetable",
    "courses",
    "faculty",
    "students",
    "programs",
    "departments",
    "semesters"
]

for table in tables:
    cursor.execute(f"DROP TABLE IF EXISTS {table}")


# ============================================================
# CREATE DATABASE SCHEMA
# ============================================================

cursor.executescript("""

CREATE TABLE departments (
    department_id INTEGER PRIMARY KEY,
    department_code TEXT UNIQUE NOT NULL,
    department_name TEXT NOT NULL,
    hod_name TEXT
);


CREATE TABLE programs (
    program_id INTEGER PRIMARY KEY,
    program_code TEXT UNIQUE NOT NULL,
    program_name TEXT NOT NULL,
    department_id INTEGER NOT NULL,
    duration_years INTEGER NOT NULL,
    FOREIGN KEY (department_id)
        REFERENCES departments(department_id)
);


CREATE TABLE semesters (
    semester_id INTEGER PRIMARY KEY,
    academic_year TEXT NOT NULL,
    semester_number INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL
);


CREATE TABLE students (
    student_id INTEGER PRIMARY KEY,
    register_number TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    gender TEXT NOT NULL,
    date_of_birth TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    program_id INTEGER NOT NULL,
    admission_year INTEGER NOT NULL,
    current_semester INTEGER NOT NULL,
    section TEXT NOT NULL,
    cgpa REAL NOT NULL,
    status TEXT NOT NULL,
    admission_type TEXT NOT NULL,

    FOREIGN KEY (program_id)
        REFERENCES programs(program_id)
);


CREATE TABLE faculty (
    faculty_id INTEGER PRIMARY KEY,
    employee_number TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    department_id INTEGER NOT NULL,
    designation TEXT NOT NULL,
    joining_date TEXT NOT NULL,

    FOREIGN KEY (department_id)
        REFERENCES departments(department_id)
);


CREATE TABLE courses (
    course_id INTEGER PRIMARY KEY,
    course_code TEXT UNIQUE NOT NULL,
    course_name TEXT NOT NULL,
    department_id INTEGER NOT NULL,
    credits INTEGER NOT NULL,
    course_type TEXT NOT NULL,
    semester INTEGER NOT NULL,

    FOREIGN KEY (department_id)
        REFERENCES departments(department_id)
);


CREATE TABLE course_offerings (
    offering_id INTEGER PRIMARY KEY,
    course_id INTEGER NOT NULL,
    semester_id INTEGER NOT NULL,
    faculty_id INTEGER NOT NULL,
    section TEXT NOT NULL,

    FOREIGN KEY (course_id)
        REFERENCES courses(course_id),

    FOREIGN KEY (semester_id)
        REFERENCES semesters(semester_id),

    FOREIGN KEY (faculty_id)
        REFERENCES faculty(faculty_id)
);


CREATE TABLE enrollments (
    enrollment_id INTEGER PRIMARY KEY,
    student_id INTEGER NOT NULL,
    offering_id INTEGER NOT NULL,
    enrollment_date TEXT NOT NULL,
    status TEXT NOT NULL,

    UNIQUE(student_id, offering_id),

    FOREIGN KEY (student_id)
        REFERENCES students(student_id),

    FOREIGN KEY (offering_id)
        REFERENCES course_offerings(offering_id)
);


CREATE TABLE attendance (
    attendance_id INTEGER PRIMARY KEY,
    enrollment_id INTEGER NOT NULL,
    attendance_date TEXT NOT NULL,
    status TEXT NOT NULL,

    FOREIGN KEY (enrollment_id)
        REFERENCES enrollments(enrollment_id)
);


CREATE TABLE internal_marks (
    mark_id INTEGER PRIMARY KEY,
    enrollment_id INTEGER NOT NULL,
    assessment_name TEXT NOT NULL,
    max_marks REAL NOT NULL,
    obtained_marks REAL NOT NULL,

    FOREIGN KEY (enrollment_id)
        REFERENCES enrollments(enrollment_id)
);


CREATE TABLE assignments (
    assignment_id INTEGER PRIMARY KEY,
    offering_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    assigned_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    max_marks REAL NOT NULL,

    FOREIGN KEY (offering_id)
        REFERENCES course_offerings(offering_id)
);


CREATE TABLE assignment_submissions (
    submission_id INTEGER PRIMARY KEY,
    assignment_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    submission_date TEXT,
    marks REAL,
    status TEXT NOT NULL,

    UNIQUE(assignment_id, student_id),

    FOREIGN KEY (assignment_id)
        REFERENCES assignments(assignment_id),

    FOREIGN KEY (student_id)
        REFERENCES students(student_id)
);


CREATE TABLE exams (
    exam_id INTEGER PRIMARY KEY,
    offering_id INTEGER NOT NULL,
    exam_type TEXT NOT NULL,
    exam_date TEXT NOT NULL,
    max_marks REAL NOT NULL,

    FOREIGN KEY (offering_id)
        REFERENCES course_offerings(offering_id)
);


CREATE TABLE exam_results (
    result_id INTEGER PRIMARY KEY,
    exam_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    marks REAL NOT NULL,
    grade TEXT NOT NULL,

    UNIQUE(exam_id, student_id),

    FOREIGN KEY (exam_id)
        REFERENCES exams(exam_id),

    FOREIGN KEY (student_id)
        REFERENCES students(student_id)
);


CREATE TABLE fees (
    fee_id INTEGER PRIMARY KEY,
    student_id INTEGER NOT NULL,
    semester_id INTEGER NOT NULL,
    fee_type TEXT NOT NULL,
    amount REAL NOT NULL,
    paid_amount REAL NOT NULL,
    due_date TEXT NOT NULL,
    payment_status TEXT NOT NULL,

    FOREIGN KEY (student_id)
        REFERENCES students(student_id),

    FOREIGN KEY (semester_id)
        REFERENCES semesters(semester_id)
);


CREATE TABLE scholarships (
    scholarship_id INTEGER PRIMARY KEY,
    student_id INTEGER NOT NULL,
    scholarship_name TEXT NOT NULL,
    amount REAL NOT NULL,
    academic_year TEXT NOT NULL,
    status TEXT NOT NULL,

    FOREIGN KEY (student_id)
        REFERENCES students(student_id)
);


CREATE TABLE timetable (
    timetable_id INTEGER PRIMARY KEY,
    offering_id INTEGER NOT NULL,
    day_of_week TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    room_number TEXT NOT NULL,

    FOREIGN KEY (offering_id)
        REFERENCES course_offerings(offering_id)
);


CREATE TABLE hostel_allocations (
    allocation_id INTEGER PRIMARY KEY,
    student_id INTEGER NOT NULL,
    hostel_name TEXT NOT NULL,
    room_number TEXT NOT NULL,
    room_type TEXT NOT NULL,
    allocation_date TEXT NOT NULL,
    status TEXT NOT NULL,

    FOREIGN KEY (student_id)
        REFERENCES students(student_id)
);


CREATE TABLE leave_requests (
    leave_id INTEGER PRIMARY KEY,
    student_id INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL,
    applied_date TEXT NOT NULL,

    FOREIGN KEY (student_id)
        REFERENCES students(student_id)
);


CREATE TABLE notifications (
    notification_id INTEGER PRIMARY KEY,
    student_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    notification_type TEXT NOT NULL,
    created_at TEXT NOT NULL,
    is_read INTEGER NOT NULL,

    FOREIGN KEY (student_id)
        REFERENCES students(student_id)
);

""")


# ============================================================
# STATIC DATA
# ============================================================

first_names = [
    "Aarav", "Arjun", "Aditya", "Rahul", "Rohan",
    "Vikram", "Karthik", "Surya", "Vivek", "Akash",
    "Ananya", "Priya", "Sneha", "Kavya", "Meera",
    "Divya", "Pooja", "Isha", "Nisha", "Aditi",
    "Sanjay", "Manoj", "Harish", "Varun", "Naveen",
    "Deepak", "Pranav", "Siddharth", "Ashwin", "Riya"
]

last_names = [
    "Sharma", "Kumar", "Patel", "Singh", "Reddy",
    "Nair", "Iyer", "Menon", "Gupta", "Verma",
    "Das", "Rao", "Joshi", "Mehta", "Bose",
    "Mishra", "Kapoor", "Chauhan", "Pillai", "Naidu"
]

departments = [
    ("CSE", "Computer Science and Engineering"),
    ("ECE", "Electronics and Communication Engineering"),
    ("EEE", "Electrical and Electronics Engineering"),
    ("MECH", "Mechanical Engineering"),
    ("CIVIL", "Civil Engineering"),
    ("AIDS", "Artificial Intelligence and Data Science"),
    ("IT", "Information Technology"),
    ("MBA", "Management Studies")
]

designations = [
    "Assistant Professor",
    "Associate Professor",
    "Professor",
    "Lecturer"
]

course_topics = {
    "CSE": [
        "Programming",
        "Data Structures",
        "Database Management Systems",
        "Operating Systems",
        "Computer Networks",
        "Computer Architecture",
        "Software Engineering",
        "Web Development",
        "Cloud Computing",
        "Cyber Security",
        "Compiler Design",
        "Distributed Systems",
        "Mobile Application Development",
        "Object Oriented Programming",
        "Theory of Computation"
    ],

    "ECE": [
        "Digital Electronics",
        "Analog Electronics",
        "Signals and Systems",
        "Communication Systems",
        "Microprocessors",
        "Embedded Systems",
        "VLSI Design",
        "Control Systems",
        "Electromagnetic Theory",
        "Digital Signal Processing",
        "Antenna Theory",
        "Wireless Communication",
        "Optical Communication",
        "IoT Systems",
        "Electronic Devices"
    ],

    "EEE": [
        "Circuit Theory",
        "Electrical Machines",
        "Power Systems",
        "Control Systems",
        "Power Electronics",
        "Digital Electronics",
        "Electrical Measurements",
        "Renewable Energy",
        "High Voltage Engineering",
        "Smart Grid",
        "Industrial Drives",
        "Energy Management",
        "Electrical Materials",
        "Microcontrollers",
        "Switchgear"
    ],

    "MECH": [
        "Engineering Mechanics",
        "Thermodynamics",
        "Fluid Mechanics",
        "Machine Design",
        "Manufacturing Technology",
        "Heat Transfer",
        "CAD and CAM",
        "Robotics",
        "Automobile Engineering",
        "Industrial Engineering",
        "Mechatronics",
        "Finite Element Analysis",
        "Material Science",
        "Dynamics of Machinery",
        "Production Planning"
    ],

    "CIVIL": [
        "Structural Engineering",
        "Concrete Technology",
        "Soil Mechanics",
        "Fluid Mechanics",
        "Surveying",
        "Transportation Engineering",
        "Environmental Engineering",
        "Geotechnical Engineering",
        "Construction Management",
        "Hydrology",
        "Foundation Engineering",
        "Building Materials",
        "Structural Analysis",
        "Water Resources",
        "Urban Planning"
    ],

    "AIDS": [
        "Artificial Intelligence",
        "Machine Learning",
        "Deep Learning",
        "Data Science",
        "Natural Language Processing",
        "Computer Vision",
        "Statistics",
        "Big Data Analytics",
        "Data Mining",
        "Reinforcement Learning",
        "Generative AI",
        "Predictive Analytics",
        "Neural Networks",
        "Data Visualization",
        "MLOps"
    ],

    "IT": [
        "Information Systems",
        "Programming",
        "Database Systems",
        "Web Technologies",
        "Computer Networks",
        "Cloud Computing",
        "Cyber Security",
        "Software Engineering",
        "DevOps",
        "Data Structures",
        "Distributed Systems",
        "UI and UX Design",
        "Mobile Computing",
        "Information Security",
        "IT Project Management"
    ],

    "MBA": [
        "Financial Management",
        "Marketing Management",
        "Human Resource Management",
        "Operations Management",
        "Business Analytics",
        "Strategic Management",
        "Organizational Behaviour",
        "Managerial Economics",
        "Business Communication",
        "Entrepreneurship",
        "Supply Chain Management",
        "Investment Management",
        "Consumer Behaviour",
        "Project Management",
        "Digital Marketing"
    ]
}


# ============================================================
# DEPARTMENTS
# ============================================================

department_ids = {}

for i, (code, name) in enumerate(departments, start=1):

    department_ids[code] = i

    hod_name = (
        random.choice(first_names)
        + " "
        + random.choice(last_names)
    )

    cursor.execute("""
        INSERT INTO departments
        (
            department_id,
            department_code,
            department_name,
            hod_name
        )
        VALUES (?, ?, ?, ?)
    """, (
        i,
        code,
        name,
        hod_name
    ))


# ============================================================
# PROGRAMS
# ============================================================

program_ids = []

program_id = 1

for code, name in departments:

    dept_id = department_ids[code]

    if code == "MBA":

        cursor.execute("""
            INSERT INTO programs
            (
                program_id,
                program_code,
                program_name,
                department_id,
                duration_years
            )
            VALUES (?, ?, ?, ?, ?)
        """, (
            program_id,
            "MBA",
            "Master of Business Administration",
            dept_id,
            2
        ))

        program_ids.append(program_id)

        program_id += 1

    else:

        cursor.execute("""
            INSERT INTO programs
            (
                program_id,
                program_code,
                program_name,
                department_id,
                duration_years
            )
            VALUES (?, ?, ?, ?, ?)
        """, (
            program_id,
            f"BTECH-{code}",
            f"B.Tech {name}",
            dept_id,
            4
        ))

        program_ids.append(program_id)

        program_id += 1


# ============================================================
# SEMESTERS
# ============================================================

semester_ids = []

semester_id = 1

for academic_year_start in range(2023, 2027):

    # Odd semester
    start = date(academic_year_start, 7, 1)
    end = date(academic_year_start, 12, 20)

    academic_year = (
        f"{academic_year_start}-"
        f"{academic_year_start + 1}"
    )

    cursor.execute("""
        INSERT INTO semesters
        VALUES (?, ?, ?, ?, ?)
    """, (
        semester_id,
        academic_year,
        1,
        start.isoformat(),
        end.isoformat()
    ))

    semester_ids.append(semester_id)

    semester_id += 1

    # Even semester
    start = date(academic_year_start + 1, 1, 5)
    end = date(academic_year_start + 1, 5, 30)

    cursor.execute("""
        INSERT INTO semesters
        VALUES (?, ?, ?, ?, ?)
    """, (
        semester_id,
        academic_year,
        2,
        start.isoformat(),
        end.isoformat()
    ))

    semester_ids.append(semester_id)

    semester_id += 1


# ============================================================
# FACULTY
# ============================================================

faculty_by_department = {}

for i in range(1, NUM_FACULTY + 1):

    fname = random.choice(first_names)
    lname = random.choice(last_names)

    dept_id = random.randint(
        1,
        len(departments)
    )

    faculty_by_department.setdefault(
        dept_id,
        []
    ).append(i)

    email = (
        f"{fname.lower()}."
        f"{lname.lower()}"
        f"{i}@university.edu"
    )

    joining_date = date(
        random.randint(2015, 2024),
        random.randint(1, 12),
        random.randint(1, 28)
    )

    cursor.execute("""
        INSERT INTO faculty
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        i,
        f"FAC{i:04d}",
        fname,
        lname,
        email,
        dept_id,
        random.choice(designations),
        joining_date.isoformat()
    ))


# ============================================================
# COURSES
# ============================================================

courses_by_department = {}

course_id = 1

prefix_map = {
    "CSE": "CS",
    "ECE": "EC",
    "EEE": "EE",
    "MECH": "ME",
    "CIVIL": "CE",
    "AIDS": "AI",
    "IT": "IT",
    "MBA": "MG"
}

for code, _ in departments:

    dept_id = department_ids[code]

    courses_by_department[dept_id] = []

    topics = course_topics[code]

    for semester in range(1, 9):

        # MBA only needs 4 semesters
        if code == "MBA" and semester > 4:
            break

        topic_index = (
            (semester - 1) * 2
        ) % len(topics)

        for j in range(2):

            topic = topics[
                (topic_index + j) % len(topics)
            ]

            cursor.execute("""
                INSERT INTO courses
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                course_id,
                f"{prefix_map[code]}"
                f"{semester}{j + 1:02d}",
                topic,
                dept_id,
                random.choice([2, 3, 4]),
                random.choice([
                    "Core",
                    "Core",
                    "Elective",
                    "Lab"
                ]),
                semester
            ))

            courses_by_department[dept_id].append(
                course_id
            )

            course_id += 1


# ============================================================
# STUDENTS
# ============================================================

student_program = {}

for student_id in range(1, NUM_STUDENTS + 1):

    program_id_value = random.choice(program_ids)

    cursor.execute("""
        SELECT department_id, duration_years
        FROM programs
        WHERE program_id = ?
    """, (program_id_value,))

    dept_id, duration = cursor.fetchone()

    if duration == 2:
        max_semester = 4
    else:
        max_semester = 8

    current_semester = random.randint(
        1,
        max_semester
    )

    admission_year = (
        2026
        - ((current_semester - 1) // 2)
    )

    fname = random.choice(first_names)
    lname = random.choice(last_names)

    dob_year = random.randint(
        1999,
        2007
    )

    email = (
        f"{fname.lower()}."
        f"{lname.lower()}"
        f"{student_id}@student.edu"
    )

    cgpa = round(
        random.uniform(5.0, 10.0),
        2
    )

    # Keep most students active
    status = random.choices(
        [
            "Active",
            "Graduated",
            "On Leave",
            "Suspended"
        ],
        weights=[
            88,
            7,
            4,
            1
        ]
    )[0]

    register_number = (
        f"{admission_year}"
        f"{department_ids[('CSE' if dept_id == 1 else departments[dept_id - 1][0])]:02d}"
        f"{student_id:04d}"
    )

    cursor.execute("""
        INSERT INTO students
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        student_id,
        register_number,
        fname,
        lname,
        random.choice(["Male", "Female"]),
        date(
            dob_year,
            random.randint(1, 12),
            random.randint(1, 28)
        ).isoformat(),
        email,
        f"9{random.randint(100000000, 999999999)}",
        program_id_value,
        admission_year,
        current_semester,
        random.choice(["A", "B", "C"]),
        cgpa,
        status,
        random.choice([
            "Merit",
            "Management",
            "Government Quota",
            "Counselling"
        ])
    ))

    student_program[student_id] = {
        "program_id": program_id_value,
        "department_id": dept_id,
        "semester": current_semester
    }


# ============================================================
# COURSE OFFERINGS
# ============================================================

offering_id = 1

offerings = []

for semester_id_value in semester_ids:

    cursor.execute("""
        SELECT semester_number
        FROM semesters
        WHERE semester_id = ?
    """, (semester_id_value,))

    semester_number = cursor.fetchone()[0]

    for dept_id in range(
        1,
        len(departments) + 1
    ):

        dept_courses = [
            cid
            for cid in courses_by_department[dept_id]
            if cursor.execute(
                "SELECT semester FROM courses WHERE course_id = ?",
                (cid,)
            ).fetchone()[0] == semester_number
        ]

        for cid in dept_courses:

            faculty_list = faculty_by_department.get(
                dept_id,
                []
            )

            if not faculty_list:
                faculty_list = list(range(
                    1,
                    NUM_FACULTY + 1
                ))

            faculty_id_value = random.choice(
                faculty_list
            )

            for section in ["A", "B"]:

                cursor.execute("""
                    INSERT INTO course_offerings
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    offering_id,
                    cid,
                    semester_id_value,
                    faculty_id_value,
                    section
                ))

                offerings.append({
                    "offering_id": offering_id,
                    "course_id": cid,
                    "semester_id": semester_id_value,
                    "faculty_id": faculty_id_value,
                    "section": section,
                    "department_id": dept_id,
                    "semester": semester_number
                })

                offering_id += 1


# ============================================================
# ENROLLMENTS
# ============================================================

enrollment_id = 1

enrollments = []

for student_id in range(
    1,
    NUM_STUDENTS + 1
):

    info = student_program[student_id]

    dept_id = info["department_id"]
    current_semester = info["semester"]

    # Use latest semester matching student's current semester
    possible_semesters = []

    for sid in semester_ids:

        cursor.execute("""
            SELECT semester_number
            FROM semesters
            WHERE semester_id = ?
        """, (sid,))

        sem_number = cursor.fetchone()[0]

        if sem_number == (
            1 if current_semester % 2 == 1 else 2
        ):
            possible_semesters.append(sid)

    if not possible_semesters:
        continue

    semester_id_value = possible_semesters[-1]

    student_section = random.choice([
        "A",
        "B",
        "C"
    ])

    valid_offerings = [
        o for o in offerings
        if o["semester_id"] == semester_id_value
        and o["department_id"] == dept_id
        and o["semester"] == (
            1 if current_semester % 2 == 1 else 2
        )
    ]

    selected_offerings = random.sample(
        valid_offerings,
        min(
            random.randint(4, 6),
            len(valid_offerings)
        )
    )

    for offering in selected_offerings:

        cursor.execute("""
            INSERT INTO enrollments
            VALUES (?, ?, ?, ?, ?)
        """, (
            enrollment_id,
            student_id,
            offering["offering_id"],
            date.today().isoformat(),
            "Enrolled"
        ))

        enrollments.append({
            "enrollment_id": enrollment_id,
            "student_id": student_id,
            "offering_id": offering["offering_id"]
        })

        enrollment_id += 1


# ============================================================
# ATTENDANCE
# ============================================================

attendance_id = 1

for enrollment in enrollments:

    number_of_classes = random.randint(
        20,
        35
    )

    for class_number in range(
        number_of_classes
    ):

        attendance_date = (
            date.today()
            - timedelta(
                days=random.randint(1, 120)
            )
        )

        status = random.choices(
            [
                "Present",
                "Absent",
                "Late"
            ],
            weights=[
                80,
                15,
                5
            ]
        )[0]

        cursor.execute("""
            INSERT INTO attendance
            VALUES (?, ?, ?, ?)
        """, (
            attendance_id,
            enrollment["enrollment_id"],
            attendance_date.isoformat(),
            status
        ))

        attendance_id += 1


# ============================================================
# INTERNAL MARKS
# ============================================================

mark_id = 1

for enrollment in enrollments:

    assessments = [
        ("Internal 1", 50),
        ("Internal 2", 50),
        ("Assignment", 20)
    ]

    for assessment_name, max_marks in assessments:

        obtained_marks = round(
            random.uniform(
                max_marks * 0.35,
                max_marks
            ),
            1
        )

        cursor.execute("""
            INSERT INTO internal_marks
            VALUES (?, ?, ?, ?, ?)
        """, (
            mark_id,
            enrollment["enrollment_id"],
            assessment_name,
            max_marks,
            obtained_marks
        ))

        mark_id += 1


# ============================================================
# ASSIGNMENTS
# ============================================================

assignment_id = 1

assignments = []

for offering in offerings:

    for number in range(1, 4):

        assigned_date = (
            date.today()
            - timedelta(
                days=random.randint(
                    20,
                    90
                )
            )
        )

        due_date = (
            assigned_date
            + timedelta(days=14)
        )

        cursor.execute("""
            INSERT INTO assignments
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            assignment_id,
            offering["offering_id"],
            f"Assignment {number}",
            "Complete the assigned academic task.",
            assigned_date.isoformat(),
            due_date.isoformat(),
            20
        ))

        assignments.append({
            "assignment_id": assignment_id,
            "offering_id": offering["offering_id"]
        })

        assignment_id += 1


# ============================================================
# ASSIGNMENT SUBMISSIONS
# ============================================================

submission_id = 1

for assignment in assignments:

    offering_id_value = assignment["offering_id"]

    enrolled_students = [
        e["student_id"]
        for e in enrollments
        if e["offering_id"] == offering_id_value
    ]

    for student_id in enrolled_students:

        status = random.choices(
            [
                "Submitted",
                "Late",
                "Not Submitted"
            ],
            weights=[
                75,
                15,
                10
            ]
        )[0]

        if status == "Not Submitted":

            submission_date = None
            marks = None

        else:

            submission_date = (
                date.today()
                - timedelta(
                    days=random.randint(
                        1,
                        30
                    )
                )
            ).isoformat()

            marks = round(
                random.uniform(
                    5,
                    20
                ),
                1
            )

        cursor.execute("""
            INSERT INTO assignment_submissions
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            submission_id,
            assignment["assignment_id"],
            student_id,
            submission_date,
            marks,
            status
        ))

        submission_id += 1


# ============================================================
# EXAMS
# ============================================================

exam_id = 1

exams = []

for offering in offerings:

    for exam_type in [
        "Internal",
        "Semester"
    ]:

        exam_date = (
            date.today()
            + timedelta(
                days=random.randint(
                    -60,
                    60
                )
            )
        )

        cursor.execute("""
            INSERT INTO exams
            VALUES (?, ?, ?, ?, ?)
        """, (
            exam_id,
            offering["offering_id"],
            exam_type,
            exam_date.isoformat(),
            100
        ))

        exams.append({
            "exam_id": exam_id,
            "offering_id": offering["offering_id"]
        })

        exam_id += 1


# ============================================================
# EXAM RESULTS
# ============================================================

result_id = 1

for exam in exams:

    offering_id_value = exam["offering_id"]

    enrolled_students = [
        e["student_id"]
        for e in enrollments
        if e["offering_id"] == offering_id_value
    ]

    for student_id in enrolled_students:

        marks = round(
            random.uniform(
                25,
                100
            ),
            1
        )

        if marks >= 90:
            grade = "A+"
        elif marks >= 80:
            grade = "A"
        elif marks >= 70:
            grade = "B+"
        elif marks >= 60:
            grade = "B"
        elif marks >= 50:
            grade = "C"
        else:
            grade = "F"

        cursor.execute("""
            INSERT INTO exam_results
            VALUES (?, ?, ?, ?, ?)
        """, (
            result_id,
            exam["exam_id"],
            student_id,
            marks,
            grade
        ))

        result_id += 1


# ============================================================
# FEES
# ============================================================

fee_id = 1

fee_types = [
    "Tuition Fee",
    "Hostel Fee",
    "Exam Fee",
    "Library Fee",
    "Transport Fee"
]

for student_id in range(
    1,
    NUM_STUDENTS + 1
):

    semester_choices = random.sample(
        semester_ids,
        random.randint(1, 3)
    )

    for semester_id_value in semester_choices:

        selected_fee_types = random.sample(
            fee_types,
            random.randint(1, 3)
        )

        for fee_type in selected_fee_types:

            amount = random.choice([
                5000,
                10000,
                15000,
                25000,
                40000,
                60000
            ])

            payment_choice = random.choice([
                "full",
                "full",
                "partial",
                "none"
            ])

            if payment_choice == "full":

                paid_amount = amount
                payment_status = "Paid"

            elif payment_choice == "partial":

                paid_amount = round(
                    amount * random.uniform(
                        0.2,
                        0.8
                    ),
                    2
                )

                payment_status = "Partial"

            else:

                paid_amount = 0
                payment_status = "Pending"

            due_date = (
                date.today()
                + timedelta(
                    days=random.randint(
                        -90,
                        90
                    )
                )
            )

            cursor.execute("""
                INSERT INTO fees
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                fee_id,
                student_id,
                semester_id_value,
                fee_type,
                amount,
                paid_amount,
                due_date.isoformat(),
                payment_status
            ))

            fee_id += 1


# ============================================================
# SCHOLARSHIPS
# ============================================================

scholarship_names = [
    "Merit Scholarship",
    "Sports Scholarship",
    "Government Scholarship",
    "Academic Excellence Scholarship",
    "Need Based Scholarship"
]

scholarship_id = 1

for student_id in range(
    1,
    NUM_STUDENTS + 1
):

    if random.random() < 0.15:

        cursor.execute("""
            INSERT INTO scholarships
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            scholarship_id,
            student_id,
            random.choice(
                scholarship_names
            ),
            random.choice([
                10000,
                20000,
                25000,
                50000
            ]),
            "2025-2026",
            random.choice([
                "Approved",
                "Approved",
                "Pending"
            ])
        ))

        scholarship_id += 1


# ============================================================
# TIMETABLE
# ============================================================

timetable_id = 1

days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday"
]

times = [
    ("09:00", "10:00"),
    ("10:00", "11:00"),
    ("11:15", "12:15"),
    ("13:15", "14:15"),
    ("14:15", "15:15")
]

for offering in offerings:

    selected_days = random.sample(
        days,
        random.randint(
            1,
            3
        )
    )

    for day in selected_days:

        start_time, end_time = random.choice(
            times
        )

        cursor.execute("""
            INSERT INTO timetable
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            timetable_id,
            offering["offering_id"],
            day,
            start_time,
            end_time,
            f"R-{random.randint(101, 405)}"
        ))

        timetable_id += 1


# ============================================================
# HOSTEL ALLOCATIONS
# ============================================================

allocation_id = 1

for student_id in range(
    1,
    NUM_STUDENTS + 1
):

    if random.random() < 0.55:

        cursor.execute("""
            INSERT INTO hostel_allocations
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            allocation_id,
            student_id,
            random.choice([
                "Block A",
                "Block B",
                "Block C",
                "Block D"
            ]),
            f"{random.randint(1, 4)}"
            f"{random.randint(1, 20):02d}",
            random.choice([
                "Single",
                "Double",
                "Triple"
            ]),
            date.today().isoformat(),
            "Active"
        ))

        allocation_id += 1


# ============================================================
# LEAVE REQUESTS
# ============================================================

leave_id = 1

reasons = [
    "Medical leave",
    "Family function",
    "Personal reasons",
    "Travel",
    "Emergency"
]

for student_id in range(
    1,
    NUM_STUDENTS + 1
):

    if random.random() < 0.25:

        start_date = (
            date.today()
            - timedelta(
                days=random.randint(
                    1,
                    60
                )
            )
        )

        end_date = (
            start_date
            + timedelta(
                days=random.randint(
                    1,
                    5
                )
            )
        )

        applied_date = (
            start_date
            - timedelta(days=2)
        )

        cursor.execute("""
            INSERT INTO leave_requests
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            leave_id,
            student_id,
            start_date.isoformat(),
            end_date.isoformat(),
            random.choice(reasons),
            random.choice([
                "Approved",
                "Pending",
                "Rejected"
            ]),
            applied_date.isoformat()
        ))

        leave_id += 1


# ============================================================
# NOTIFICATIONS
# ============================================================

notification_id = 1

notification_templates = [
    (
        "Fee Payment Reminder",
        "Your semester fee payment is pending.",
        "Finance"
    ),

    (
        "Assignment Due",
        "You have an assignment approaching its deadline.",
        "Academic"
    ),

    (
        "Attendance Warning",
        "Your attendance is below the required percentage.",
        "Attendance"
    ),

    (
        "Exam Notification",
        "Your upcoming examination schedule has been published.",
        "Exam"
    ),

    (
        "Library Reminder",
        "Please return your overdue library books.",
        "Library"
    )
]

for student_id in range(
    1,
    NUM_STUDENTS + 1
):

    for _ in range(
        random.randint(
            1,
            5
        )
    ):

        title, message, notification_type = (
            random.choice(
                notification_templates
            )
        )

        created_at = (
            date.today()
            - timedelta(
                days=random.randint(
                    0,
                    60
                )
            )
        )

        cursor.execute("""
            INSERT INTO notifications
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            notification_id,
            student_id,
            title,
            message,
            notification_type,
            created_at.isoformat(),
            random.choice([
                0,
                0,
                1
            ])
        ))

        notification_id += 1


# ============================================================
# INDEXES
# ============================================================

cursor.executescript("""

CREATE INDEX idx_students_program
ON students(program_id);

CREATE INDEX idx_students_register
ON students(register_number);

CREATE INDEX idx_students_status
ON students(status);

CREATE INDEX idx_students_cgpa
ON students(cgpa);

CREATE INDEX idx_faculty_department
ON faculty(department_id);

CREATE INDEX idx_courses_department
ON courses(department_id);

CREATE INDEX idx_courses_semester
ON courses(semester);

CREATE INDEX idx_offerings_course
ON course_offerings(course_id);

CREATE INDEX idx_offerings_semester
ON course_offerings(semester_id);

CREATE INDEX idx_offerings_faculty
ON course_offerings(faculty_id);

CREATE INDEX idx_enrollments_student
ON enrollments(student_id);

CREATE INDEX idx_enrollments_offering
ON enrollments(offering_id);

CREATE INDEX idx_attendance_enrollment
ON attendance(enrollment_id);

CREATE INDEX idx_attendance_date
ON attendance(attendance_date);

CREATE INDEX idx_internal_marks_enrollment
ON internal_marks(enrollment_id);

CREATE INDEX idx_assignments_offering
ON assignments(offering_id);

CREATE INDEX idx_assignment_submissions_student
ON assignment_submissions(student_id);

CREATE INDEX idx_exam_results_student
ON exam_results(student_id);

CREATE INDEX idx_exam_results_exam
ON exam_results(exam_id);

CREATE INDEX idx_fees_student
ON fees(student_id);

CREATE INDEX idx_fees_status
ON fees(payment_status);

CREATE INDEX idx_scholarships_student
ON scholarships(student_id);

CREATE INDEX idx_hostel_student
ON hostel_allocations(student_id);

CREATE INDEX idx_leave_student
ON leave_requests(student_id);

CREATE INDEX idx_notifications_student
ON notifications(student_id);

""")


# ============================================================
# COMMIT DATABASE
# ============================================================

conn.commit()


# ============================================================
# DATABASE SUMMARY
# ============================================================

print()
print("=" * 60)
print("        STUDENT ERP DATABASE GENERATED")
print("=" * 60)

for table in tables:

    cursor.execute(
        f"SELECT COUNT(*) FROM {table}"
    )

    count = cursor.fetchone()[0]

    print(
        f"{table:<30} {count:>10,}"
    )

print("=" * 60)
print(f"Database file: {DB_NAME}")
print("=" * 60)

conn.close()