import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listDoctors, upsertDoctor, setDoctorActive } from "@/lib/queries/doctors";
import { Stethoscope, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function DoctorsPage() {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newDeg, setNewDeg] = useState("");
  const { data: doctors = [] } = useQuery({ queryKey: ['doctors'], queryFn: () => listDoctors(false) });

  const add = useMutation({
    mutationFn: () => upsertDoctor(newName.trim(), newDeg.trim()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['doctors'] }); setNewName(""); setNewDeg(""); },
  });

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: number; active: number }) => setDoctorActive(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['doctors'] }),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Doctors / Referrers</h1>

      {/* Add new */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2"><Plus size={16} /> Add Doctor</h2>
        <div className="flex gap-3">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Doctor name (e.g. DR RAKESH SHARMA)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500" />
          <input value={newDeg} onChange={e => setNewDeg(e.target.value)} placeholder="Degree (optional)"
            className="w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-maroon-500" />
          <button onClick={() => newName.trim() && add.mutate()} disabled={!newName.trim() || add.isPending}
            className="bg-maroon-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-maroon-700 disabled:opacity-60">
            Add
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
              <th className="px-6 py-3 text-left">Name</th>
              <th className="px-6 py-3 text-left">Degree</th>
              <th className="px-6 py-3 text-left">Status</th>
              <th className="px-6 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {doctors.map(d => (
              <tr key={d.id} className="hover:bg-gray-50">
                <td className="px-6 py-3 text-sm font-medium text-gray-900">{d.name}</td>
                <td className="px-6 py-3 text-sm text-gray-500">{d.degree ?? '—'}</td>
                <td className="px-6 py-3">
                  <span className={cn("px-2 py-1 rounded-full text-xs font-medium", d.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                    {d.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-3">
                  <button onClick={() => toggle.mutate({ id: d.id, active: d.active ? 0 : 1 })}
                    className="text-xs text-maroon-600 hover:underline">
                    {d.active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
