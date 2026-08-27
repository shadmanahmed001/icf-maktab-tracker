import React, { useState, useEffect } from 'react';
import { Printer, Download, BookOpen, CheckCircle, Clock, ShieldCheck, AlertCircle } from 'lucide-react';
import { api } from '../api';

export default function ReportsView({ currentTerm }) {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      setLoading(true);
      try {
        const res = await api.getAdminDashboard();
        if (res.success) {
          setDashboardData(res.data);
        }
      } catch (err) {
        console.error('Failed to load report data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [currentTerm?.id]);

  const handlePrint = () => {
    window.print();
  };

  if (loading || !dashboardData) {
    return <div className="p-8 text-center text-xs text-slate-500">Generating report...</div>;
  }

  const { classPacing, stats } = dashboardData;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      
      {/* Non-printable action header */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm print:hidden">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Academic Pacing & Standards Report</h2>
          <p className="text-xs text-slate-500">Ready for weekly Shura / Maktab Board review</p>
        </div>

        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm transition-all cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          Print / Save PDF Report
        </button>
      </div>

      {/* Printable Sheet */}
      <div className="bg-white p-8 rounded-2xl border border-slate-300 shadow-sm space-y-6 text-slate-900 print:border-0 print:p-0 print:shadow-none">
        
        {/* Report Header */}
        <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-emerald-800">
              Islamic Center of Fremont • Daily Maktab
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-0.5">
              Academic Standards & Pacing Digest
            </h1>
            <p className="text-xs text-slate-600">
              Academic Year 2026–2027 • An-Nasīḥah Islamic Studies Standards
            </p>
          </div>

          <div className="text-right text-xs space-y-0.5">
            <div className="font-bold text-slate-800">Term: {currentTerm?.title}</div>
            <div className="text-slate-500">{currentTerm?.date_range}</div>
            <div className="text-[11px] text-slate-400">Report Date: {new Date().toLocaleDateString()}</div>
          </div>
        </div>

        {/* Executive Summary Stats */}
        <div className="grid grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
          <div>
            <div className="text-xs text-slate-500 uppercase font-semibold">Total Classes</div>
            <div className="text-lg font-bold text-slate-900">{stats.totalClasses}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase font-semibold">Total Students</div>
            <div className="text-lg font-bold text-slate-900">{stats.totalStudents}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase font-semibold">On Track</div>
            <div className="text-lg font-bold text-emerald-700">{stats.classesOnTrack}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase font-semibold">Action Needed</div>
            <div className="text-lg font-bold text-amber-700">{stats.classesBehind}</div>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-300 text-slate-700 font-bold bg-slate-100/70">
                <th className="py-2.5 px-3">Class / Grade</th>
                <th className="py-2.5 px-3">Assigned Teacher</th>
                <th className="py-2.5 px-3 text-center">Completion</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3">Next Scheduled Topic</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {classPacing.map((cp) => (
                <tr key={cp.class.id} className="hover:bg-slate-50/50">
                  <td className="py-3 px-3 font-bold text-slate-900">
                    {cp.class.name}
                    {cp.class.gender_track !== 'general' && (
                      <span className="ml-1.5 text-[10px] text-slate-500 uppercase">({cp.class.gender_track})</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-slate-700 font-medium">
                    {cp.class.teacher_name} ({cp.class.room || 'Main Hall'})
                  </td>
                  <td className="py-3 px-3 text-center font-bold">
                    {cp.completionPercent}% ({cp.completedCount}/{cp.totalRequired})
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                      cp.pacingStatus === 'on_track'
                        ? 'bg-emerald-100 text-emerald-800'
                        : cp.pacingStatus === 'in_progress'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                    }`}>
                      {cp.pacingStatus === 'on_track' ? 'ON PACE' : cp.pacingStatus === 'in_progress' ? 'IN PROGRESS' : 'BEHIND'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-slate-600 text-[11px]">
                    {cp.nextTopic ? (
                      <span>
                        <strong className="text-slate-800">{cp.nextTopic.day_of_week} ({cp.nextTopic.subject}):</strong> {cp.nextTopic.topic_title}
                      </span>
                    ) : (
                      <span className="text-emerald-700 font-semibold">✓ All term strands completed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Administration Signoff Box */}
        <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-xs text-slate-600">
          <div>
            <div className="border-b border-slate-400 pb-8 mb-1" />
            <div className="font-bold text-slate-800">Academic Standards Lead Signature</div>
            <div className="text-[11px] text-slate-400">Islamic Center of Fremont Maktab</div>
          </div>
          <div>
            <div className="border-b border-slate-400 pb-8 mb-1" />
            <div className="font-bold text-slate-800">Masjid Director / Principal Signature</div>
            <div className="text-[11px] text-slate-400">Date: ________________________</div>
          </div>
        </div>

      </div>

    </div>
  );
}
