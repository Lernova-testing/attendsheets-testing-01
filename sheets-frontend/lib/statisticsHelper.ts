import type { Student } from '@/types';

interface AttendanceValue {
    sessions?: Array<{ id: string; name: string; status: 'P' | 'A' | 'L' }>;
    status?: 'P' | 'A' | 'L';
    count?: number;
}

function normalizeIdentityValue(value: unknown): string {
    if (typeof value === 'string') return value.trim().toLowerCase();
    if (typeof value === 'number') return String(value);
    return '';
}

export function getStudentIdentityKey(
    student: Student,
    enrollmentMode?: 'enrollment_via_id' | 'manual_entry' | 'import_data'
): string {
    const email = normalizeIdentityValue((student as Record<string, unknown>).email);
    if (email) return `email:${email}`;

    const rollNo = normalizeIdentityValue(student.rollNo);
    const name = normalizeIdentityValue(student.name);

    // For manual/imported classes, prefer stricter matching when both values exist.
    if ((enrollmentMode === 'manual_entry' || enrollmentMode === 'import_data') && name && rollNo) {
        return `name-roll:${name}:${rollNo}`;
    }

    if (name) return `name:${name}`;
    if (rollNo) return `roll:${rollNo}`;

    const id = normalizeIdentityValue(student.id);
    return id ? `id:${id}` : 'unknown-student';
}

function countAttendanceValue(
    attendanceValue: AttendanceValue | 'P' | 'A' | 'L' | undefined
): { present: number; absent: number; late: number; total: number } {
    let present = 0;
    let absent = 0;
    let late = 0;
    let total = 0;

    if (!attendanceValue) {
        return { present, absent, late, total };
    }

    if (typeof attendanceValue === 'object' && 'sessions' in attendanceValue && attendanceValue.sessions) {
        attendanceValue.sessions.forEach((session) => {
            if (!session.status) return;
            total++;
            if (session.status === 'P') present++;
            else if (session.status === 'A') absent++;
            else if (session.status === 'L') late++;
        });
        return { present, absent, late, total };
    }

    if (typeof attendanceValue === 'object' && 'status' in attendanceValue && attendanceValue.status) {
        const count = attendanceValue.count || 1;
        total += count;
        if (attendanceValue.status === 'P') present += count;
        else if (attendanceValue.status === 'A') absent += count;
        else if (attendanceValue.status === 'L') late += count;
        return { present, absent, late, total };
    }

    if (typeof attendanceValue === 'string') {
        total++;
        if (attendanceValue === 'P') present++;
        else if (attendanceValue === 'A') absent++;
        else if (attendanceValue === 'L') late++;
    }

    return { present, absent, late, total };
}

export function calculateStudentAttendance(
    attendance: Record<string, AttendanceValue | 'P' | 'A' | 'L' | undefined>,
    daysInMonth: number,
    currentMonth: number,
    currentYear: number
): { present: number; absent: number; late: number; total: number; percentage: number } {
    let present = 0;
    let absent = 0;
    let late = 0;
    let total = 0;

    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const counted = countAttendanceValue(attendance[dateKey]);
        present += counted.present;
        absent += counted.absent;
        late += counted.late;
        total += counted.total;
    }

    const percentage = total > 0 ? ((present + late) / total) * 100 : 0;
    return { present, absent, late, total, percentage };
}

export function calculateStudentAttendanceForRange(
    attendance: Record<string, AttendanceValue | 'P' | 'A' | 'L' | undefined>,
    startMonth: number,
    startYear: number,
    endMonth: number,
    endYear: number
): { present: number; absent: number; late: number; total: number; percentage: number } {
    let present = 0;
    let absent = 0;
    let late = 0;
    let total = 0;

    const startDate = new Date(startYear, startMonth, 1);
    const endDate = new Date(endYear, endMonth + 1, 0, 23, 59, 59, 999);

    Object.entries(attendance).forEach(([dateKey, value]) => {
        const date = new Date(`${dateKey}T00:00:00`);
        if (Number.isNaN(date.getTime())) return;
        if (date < startDate || date > endDate) return;

        const counted = countAttendanceValue(value);
        present += counted.present;
        absent += counted.absent;
        late += counted.late;
        total += counted.total;
    });

    const percentage = total > 0 ? ((present + late) / total) * 100 : 0;
    return { present, absent, late, total, percentage };
}

export function getStatusFromPercentage(
    percentage: number,
    thresholds: {
        excellent: number;
        good: number;
        moderate: number;
        atRisk: number;
    }
): 'excellent' | 'good' | 'moderate' | 'risk' {
    if (percentage >= thresholds.excellent) return 'excellent';
    if (percentage >= thresholds.good) return 'good';
    if (percentage >= thresholds.moderate) return 'moderate';
    return 'risk';
}
