import React, { useState, useEffect } from 'react';
import { BookOpen, Sparkles, CheckCircle2, ShieldCheck, ChevronRight, Award, Layers } from 'lucide-react';
import { api } from '../api';

const GRADE_OUTCOMES = {
  1: "By June, the student can name and briefly explain the five pillars, perform wuḍū' correctly, recite and explain five aḥādīth, recount the Prophet ﷺ's childhood through his marriage and the stories of Ādam and Nūḥ AS, know the Articles of Faith with Ar-Razzāq and Ar-Raḥmān, and display five akhlāq and the ādāb of daily life.",
  2: "By June, the student can perform wuḍū' with its farā'iḍ and sunan and the method of ṣalāh, recite and explain five aḥādīth, recount the first revelation through the early persecutions and the stories of Hūd and Ṣāliḥ AS, know Allāh's attributes (the Protector, All-Hearing, All-Seeing, the One) and belief in angels, books, and the Qur'ān, and display five akhlāq and the ādāb of social life.",
  3: "By June, the student can perform ṣalāh with correct arkān and method, recite and explain ten aḥādīth, recount the Sīrah from Abyssinia to the Miʿrāj and the Ibrāhīm–Ismāʿīl narrative, know the belief in the Messengers and the signs of Qiyāmah, and display five akhlāq and five ādāb.",
  4: "By June, the student can explain masaḥ ʿalal khuffayn, the wājibāt of ṣalāh with sajdah sahw, and the fiqh of ṣawm and tarāwīḥ; recite and explain ten aḥādīth; recount the pledges of ʿAqabah through the major battles and the story of Yūsuf AS; know the major signs of Qiyāmah in detail; and display four akhlāq and five ādāb.",
  5: "By June, the student can explain the detailed fiqh of wuḍū' and tayammum, the sunan of ṣalāh, qaḍā', ʿĪd, and the rites of Ḥajj and ʿUmrah; recite and explain ten aḥādīth and the 99 Names; recount Ḥudaybiyah through the Prophet ﷺ's passing and the stories of Mūsā and ʿĪsā AS; know the fiqh of death, the grave, Jannah, and Jahannam; and display the akhlāq of mashwarah, ṣabr, and kinship with five ādāb.",
  6: "By June, the student can explain the fiqh of water, impurities, the wājibāt of ṣalāh, and janā'iz (with gender-specific fiqh of maturity); recite and explain fifteen aḥādīth; know the Prophet ﷺ's shamā'il, the life of Abū Bakr, and the Mothers of the Believers, and the stories of Dāwūd, Sulaymān, and Yūnus AS with the Umayyad period; understand nubuwwah, the ranks of the Ṣaḥābah, muʿjizāt, and karāmāt; and internalize the akhlāq against oppression, envy, ghībah, and pride."
};

const GRADE_AGES = {
  1: 'Ages 6–7',
  2: 'Ages 7–8',
  3: 'Ages 8–9',
  4: 'Ages 9–10',
  5: 'Ages 10–11',
  6: 'Ages 11–12'
};

export default function CurriculumExplorer({ terms }) {
  const [selectedGrade, setSelectedGrade] = useState(1);
  const [selectedTermNumber, setSelectedTermNumber] = useState(1);
  const [genderTrack, setGenderTrack] = useState('general');
  const [topics, setTopics] = useState([]);
  const [memorization, setMemorization] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSyllabus = async () => {
      setLoading(true);
      try {
        const res = await api.getCurriculum({
          grade: selectedGrade,
          term_number: selectedTermNumber,
          gender_track: selectedGrade === 6 ? genderTrack : 'general'
        });
        if (res.success) {
          setTopics(res.data.topics || []);
          setMemorization(res.data.memorization || []);
        }
      } catch (err) {
        console.error('Failed to load curriculum:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSyllabus();
  }, [selectedGrade, selectedTermNumber, genderTrack]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm space-y-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase tracking-wider mb-1">
            <BookOpen className="w-4 h-4" />
            An-Nasīḥah Islamic Studies Standards
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            ICF Daily Maktab Academic Standards & Benchmarks
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Full 2026–2027 curriculum across all 4 terms, weekly subject strands, and daily opening memorization tracks.
          </p>
        </div>

        {/* Grade Selector Tabs */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
          {[1, 2, 3, 4, 5, 6].map((g) => (
            <button
              key={g}
              onClick={() => {
                setSelectedGrade(g);
                if (g !== 6) setGenderTrack('general');
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                selectedGrade === g
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-700/20'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Grade {g} ({GRADE_AGES[g]})
            </button>
          ))}
        </div>

        {/* Grade 6 Gender Track Toggle */}
        {selectedGrade === 6 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="text-amber-900">
              <span className="font-bold">⚠️ Grade 6 Gender Track Split:</span> An-Nasīḥah Coursebook 6 splits by gender for Fiqh (Boys: imāmah, adhān & iqāmah, Jumuʿah; Girls: fiqh of ḥayḍ, nifās, istiḥāḍah).
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => setGenderTrack('general')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${
                  genderTrack === 'general' ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border'
                }`}
              >
                All / General
              </button>
              <button
                onClick={() => setGenderTrack('boys')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${
                  genderTrack === 'boys' ? 'bg-blue-600 text-white' : 'bg-white text-blue-700 border'
                }`}
              >
                Boys Track
              </button>
              <button
                onClick={() => setGenderTrack('girls')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${
                  genderTrack === 'girls' ? 'bg-pink-600 text-white' : 'bg-white text-pink-700 border'
                }`}
              >
                Girls Track
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Yearly Outcome Card */}
      <div className="bg-gradient-to-r from-emerald-900 to-slate-900 text-white rounded-2xl p-5 shadow-sm border border-emerald-800 space-y-2">
        <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider">
          <Award className="w-4 h-4" />
          Grade {selectedGrade} Yearly Outcome (By June 2027)
        </div>
        <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
          {GRADE_OUTCOMES[selectedGrade]}
        </p>
      </div>

      {/* Term Selector Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { num: 1, label: 'Term 1 (Aug–Oct)' },
          { num: 2, label: 'Term 2 (Oct–Dec)' },
          { num: 3, label: 'Term 3 (Dec–Feb)' },
          { num: 4, label: 'Term 4 (Mar–Jun)' }
        ].map((t) => (
          <button
            key={t.num}
            onClick={() => setSelectedTermNumber(t.num)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedTermNumber === t.num
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Term Standards Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Weekly Strands (Left 2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-600" />
            Weekly Subject Strands — Term {selectedTermNumber}
          </h3>

          <div className="space-y-3">
            {topics.map((t) => (
              <div 
                key={t.id}
                className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-bold text-xs border border-emerald-200">
                    {t.day_of_week} — {t.subject}
                  </span>
                  {t.gender_track !== 'general' && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      t.gender_track === 'boys' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                    }`}>
                      {t.gender_track} track
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {t.topic_title}
                  </h4>
                  <p className="text-[11px] text-slate-400">An-Nasīḥah Coursebook {selectedGrade}</p>
                </div>

                {/* Expected indicator */}
                <div className="bg-amber-50/80 border border-amber-200/70 rounded-xl p-3 space-y-1">
                  <div className="text-[11px] font-bold text-amber-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
                    Expected by End of Term (Observable Benchmark)
                  </div>
                  <p className="text-xs text-amber-950 font-medium leading-relaxed">
                    {t.expected_indicator}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Memorization Track for this Term (Right col) */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            Daily Memorization Track — Term {selectedTermNumber}
          </h3>

          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm space-y-4">
            <p className="text-xs text-slate-500">
              Assessed via daily oral recitation with correct tajwīd during the opening 15 minutes of class:
            </p>

            {memorization.map((m) => (
              <div key={m.id} className="space-y-3 text-xs">
                
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-700 block">📖 Sūrah:</span>
                  <p className="text-slate-900 font-semibold">{m.surah}</p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-700 block">🤲 Duʿā':</span>
                  <p className="text-slate-900 font-semibold">{m.dua}</p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <span className="font-bold text-slate-700 block">✨ Names of Allāh:</span>
                  <p className="text-slate-900 font-semibold">{m.names_of_allah}</p>
                </div>

              </div>
            ))}

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-[11px] text-emerald-800 space-y-1">
              <span className="font-bold block">💡 Testing & Consolidation Note:</span>
              <p>Surplus sessions in the term calendar are reserved for practical demonstration, oral recitation testing, and revision.</p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
