import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase, Course, Enrollment } from '../lib/supabase';
import { BookOpen, Users, Brain, FileText, TrendingUp, Clock, Settings, Crown, Shield } from 'lucide-react';

export default function Dashboard() {
  const { profile, isSuperAdmin, isAdmin } = useAuth();
  const [stats, setStats] = useState({
    totalCourses: 0,
    enrolledCourses: 0,
    completedQuizzes: 0,
    totalUsers: 0,
    totalQuizzes: 0,
    totalEnrollments: 0
  });
  const [recentCourses, setRecentCourses] = useState<(Course & { enrolled_at?: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [profile]);

  const loadDashboardData = async () => {
    if (!profile) return;

    try {
      if (isSuperAdmin()) {
        // Superadmin dashboard - system overview
        const [coursesCount, usersCount, enrollmentsCount, quizzesCount, recentCoursesData] = await Promise.all([
          supabase.from('courses').select('id', { count: 'exact', head: true }),
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('enrollments').select('id', { count: 'exact', head: true }),
          supabase.from('quizzes').select('id', { count: 'exact', head: true }),
          supabase.from('courses').select('*').order('created_at', { ascending: false }).limit(5)
        ]);

        setStats({
          totalCourses: coursesCount.count || 0,
          totalUsers: usersCount.count || 0,
          totalEnrollments: enrollmentsCount.count || 0,
          totalQuizzes: quizzesCount.count || 0,
          enrolledCourses: 0,
          completedQuizzes: 0
        });

        setRecentCourses(recentCoursesData || []);
      } else if (isAdmin()) {
        // Course admin dashboard - their courses overview
        const { data: adminCourses } = await supabase
          .from('course_admins')
          .select('course_id')
          .eq('admin_id', profile.id);
        
        const courseIds = adminCourses?.map(ca => ca.course_id) || [];
        
        let coursesQuery = supabase.from('courses').select('*');
        if (courseIds.length > 0) {
          coursesQuery = coursesQuery.in('id', courseIds);
        } else {
          coursesQuery = coursesQuery.eq('created_by', profile.id);
        }

        const [coursesData, enrollmentsCount, quizzesCount] = await Promise.all([
          coursesQuery.order('created_at', { ascending: false }),
          courseIds.length > 0 
            ? supabase.from('enrollments').select('id', { count: 'exact', head: true }).in('course_id', courseIds)
            : supabase.from('enrollments').select('id', { count: 'exact', head: true }).in('course_id', []),
          courseIds.length > 0
            ? supabase.from('quizzes').select('id', { count: 'exact', head: true }).in('course_id', courseIds)
            : supabase.from('quizzes').select('id', { count: 'exact', head: true }).in('course_id', [])
        ]);

        setStats({
          totalCourses: coursesData.data?.length || 0,
          totalEnrollments: enrollmentsCount.count || 0,
          totalQuizzes: quizzesCount.count || 0,
          enrolledCourses: 0,
          completedQuizzes: 0,
          totalUsers: 0
        });

        setRecentCourses(coursesData.data || []);
      } else {
        // Regular user dashboard - their learning progress
        const { data: enrollments, error: enrollmentsError } = await supabase
          .from('enrollments')
          .select(`
            *,
            courses (*)
          `)
          .eq('user_id', profile.id)
          .order('enrolled_at', { ascending: false })
          .limit(5);

        if (enrollmentsError) throw enrollmentsError;

        const coursesWithEnrollment = enrollments?.map(enrollment => ({
          ...enrollment.courses,
          enrolled_at: enrollment.enrolled_at
        })) || [];

        setRecentCourses(coursesWithEnrollment);

        // Load user stats
        const [coursesCount, enrollmentsCount, quizzesCount] = await Promise.all([
          supabase.from('courses').select('id', { count: 'exact', head: true }),
          supabase.from('enrollments').select('id', { count: 'exact', head: true }).eq('user_id', profile.id),
          supabase.from('quiz_attempts').select('id', { count: 'exact', head: true }).eq('user_id', profile.id).eq('completed', true)
        ]);

        setStats({
          totalCourses: coursesCount.count || 0,
          enrolledCourses: enrollmentsCount.count || 0,
          completedQuizzes: quizzesCount.count || 0,
          totalUsers: 0,
          totalQuizzes: 0,
          totalEnrollments: 0
        });
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const StatCard = ({ icon: Icon, title, value, color }: { 
    icon: any, 
    title: string, 
    value: number, 
    color: string 
  }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
      <div className="flex items-center">
        <div className={`p-2 sm:p-3 rounded-lg ${color} flex-shrink-0`}>
          <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </div>
        <div className="ml-3 sm:ml-4 min-w-0 flex-1">
          <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400 truncate">{title}</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        </div>
      </div>
    </div>
  );

  const getWelcomeMessage = () => {
    if (isSuperAdmin()) {
      return {
        title: `Welcome back, ${profile?.name}!`,
        subtitle: "System Administrator Dashboard - Monitor and manage the entire platform.",
        icon: Crown
      };
    } else if (isAdmin()) {
      return {
        title: `Welcome back, ${profile?.name}!`,
        subtitle: "Course Administrator Dashboard - Manage your courses and content.",
        icon: Shield
      };
    } else {
      return {
        title: `Welcome back, ${profile?.name}!`,
        subtitle: "Continue your learning journey and track your progress.",
        icon: BookOpen
      };
    }
  };

  const welcome = getWelcomeMessage();

  const getStatsCards = () => {
    if (isSuperAdmin()) {
      return [
        <StatCard key="users" icon={Users} title="Total Users" value={stats.totalUsers} color="bg-purple-500" />,
        <StatCard key="courses" icon={BookOpen} title="Total Courses" value={stats.totalCourses} color="bg-blue-500" />,
        <StatCard key="enrollments" icon={TrendingUp} title="Total Enrollments" value={stats.totalEnrollments} color="bg-emerald-500" />,
        <StatCard key="quizzes" icon={Brain} title="Total Quizzes" value={stats.totalQuizzes} color="bg-orange-500" />
      ];
    } else if (isAdmin()) {
      return [
        <StatCard key="courses\" icon={BookOpen} title="My Courses" value={stats.totalCourses} color="bg-blue-500" />,
        <StatCard key="enrollments" icon={Users} title="Total Enrollments" value={stats.totalEnrollments} color="bg-emerald-500" />,
        <StatCard key="quizzes" icon={Brain} title="My Quizzes" value={stats.totalQuizzes} color="bg-purple-500" />
      ];
    } else {
      return [
        <StatCard key="enrolled\" icon={BookOpen} title="Enrolled Courses" value={stats.enrolledCourses} color="bg-blue-500" />,
        <StatCard key="completed" icon={Brain} title="Completed Quizzes" value={stats.completedQuizzes} color="bg-emerald-500" />,
        <StatCard key="available" icon={TrendingUp} title="Available Courses" value={stats.totalCourses} color="bg-orange-500" />
      ];
    }
  };

  const getQuickActions = () => {
    if (isSuperAdmin()) {
      return [
        {
          href: "/admin/users",
          icon: Users,
          title: "Manage Users",
          description: "Add and manage user accounts",
          color: "bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/30",
          iconColor: "text-purple-600 dark:text-purple-400"
        },
        {
          href: "/admin/courses",
          icon: BookOpen,
          title: "Manage Courses",
          description: "Create and edit courses",
          color: "bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30",
          iconColor: "text-blue-600 dark:text-blue-400"
        },
        {
          href: "/admin/settings",
          icon: Settings,
          title: "System Settings",
          description: "Configure platform settings",
          color: "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/30",
          iconColor: "text-emerald-600 dark:text-emerald-400"
        }
      ];
    } else if (isAdmin()) {
      return [
        {
          href: "/admin/courses",
          icon: BookOpen,
          title: "Manage Courses",
          description: "Create and edit your courses",
          color: "bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30",
          iconColor: "text-blue-600 dark:text-blue-400"
        },
        {
          href: "/admin/quizzes",
          icon: Brain,
          title: "Manage Quizzes",
          description: "Create and edit quizzes",
          color: "bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/30",
          iconColor: "text-purple-600 dark:text-purple-400"
        }
      ];
    } else {
      return [
        {
          href: "/my-courses",
          icon: BookOpen,
          title: "My Courses",
          description: "View enrolled courses",
          color: "bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30",
          iconColor: "text-blue-600 dark:text-blue-400"
        },
        {
          href: "/available-courses",
          icon: FileText,
          title: "Browse Courses",
          description: "Find new courses",
          color: "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/30",
          iconColor: "text-emerald-600 dark:text-emerald-400"
        },
        {
          href: "/certificates",
          icon: TrendingUp,
          title: "My Certificates",
          description: "View achievements",
          color: "bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/30",
          iconColor: "text-orange-600 dark:text-orange-400"
        }
      ];
    }
  };

  const getRecentSectionTitle = () => {
    if (isSuperAdmin()) return "Recent Courses";
    if (isAdmin()) return "My Courses";
    return "Recent Courses";
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex items-start sm:items-center">
        <div className="p-2 sm:p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg mr-3 sm:mr-4 flex-shrink-0">
          <welcome.icon className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white truncate">{welcome.title}</h1>
          <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-400">{welcome.subtitle}</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols43 xl:grid-cols-4 gap-4 sm:gap-6">
        {getStatsCards()}
      </div>

      {/* Recent Courses */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{getRecentSectionTitle()}</h2>
        </div>
        <div className="p-4 sm:p-6">
          {recentCourses.length > 0 ? (
            <div className="space-y-3 sm:space-y-4">
              {recentCourses.map((course) => (
                <div key={course.id} className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center min-w-0 flex-1">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex-shrink-0">
                      <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="ml-3 min-w-0 flex-1">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">{course.title}</h3>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">{course.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center text-xs sm:text-sm text-gray-500 dark:text-gray-400 ml-3 flex-shrink-0">
                    <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                    <span className="hidden sm:inline">
                      {course.enrolled_at 
                        ? new Date(course.enrolled_at).toLocaleDateString()
                        : new Date(course.created_at).toLocaleDateString()
                      }
                    </span>
                    <span className="sm:hidden">
                      {course.enrolled_at 
                        ? new Date(course.enrolled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : new Date(course.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      }
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 sm:py-12">
              <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400">
                {isSuperAdmin() || isAdmin() 
                  ? "No courses created yet." 
                  : "No courses enrolled yet."
                }
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                {isSuperAdmin() || isAdmin()
                  ? "Create your first course to get started!"
                  : "Explore available courses to start learning!"
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Quick Actions</h2>
        </div>
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {getQuickActions().map((action, index) => (
              <a
                key={index}
                href={action.href}
                className={`flex items-center p-3 sm:p-4 rounded-lg transition-colors ${action.color}`}
              >
                <action.icon className={`w-6 h-6 sm:w-8 sm:h-8 mr-3 flex-shrink-0 ${action.iconColor}`} />
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-gray-900 dark:text-white text-sm sm:text-base">{action.title}</h3>
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">{action.description}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}