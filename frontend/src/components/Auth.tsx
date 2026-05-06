"use client";

import { motion } from "framer-motion";
import { User, ShieldAlert, Ghost, Compass } from "lucide-react";

const USERS = [
  { name: "Jacky", icon: User, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { name: "Sascha", icon: ShieldAlert, color: "text-blue-400", bg: "bg-blue-500/10" },
  { name: "Guest", icon: Ghost, color: "text-neutral-400", bg: "bg-neutral-500/10" }
];

export default function Auth({ onLogin }: { onLogin: (username: string) => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-neutral-950 text-neutral-100">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full text-center"
      >
        <div className="flex items-center justify-center gap-3 mb-8">
          <Compass className="w-12 h-12 text-emerald-500" />
          <h1 className="text-4xl font-bold tracking-tighter">Lighthouse</h1>
        </div>
        
        <h2 className="text-2xl font-semibold mb-2">Welcome Back</h2>
        <p className="text-neutral-500 mb-12">Select your profile to continue your journey.</p>

        <div className="grid gap-4">
          {USERS.map((u) => (
            <button
              key={u.name}
              onClick={() => onLogin(u.name)}
              className="w-full group flex items-center gap-4 p-6 rounded-3xl bg-neutral-900 border border-neutral-800 hover:border-emerald-500/50 hover:bg-neutral-800/50 transition-all text-left"
            >
              <div className={`w-14 h-14 rounded-2xl ${u.bg} flex items-center justify-center ${u.color} group-hover:scale-110 transition-transform`}>
                <u.icon className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-xl font-bold">{u.name}</h3>
                <p className="text-sm text-neutral-500">
                  {u.name === "Guest" ? "Transient session" : "Personalized experience"}
                </p>
              </div>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
