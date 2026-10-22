// EVE-Omni-Hilfsprozess (Windows). Wird von main.js als PowerShell-Skript mit Add-Type gestartet (C# 5, .NET Framework).
// Aufgaben:
//  1. Melden, welches Programm vorne ist ("FG <hwnd> <prozess>") und wann kopiert wurde ("CLIP <n>").
//  2. Overlay-Fenster hinter ein fremdes Programm legen ("BELOW <unser hwnd> <fremdes hwnd>").
//  3. EVE-Clients finden ("EVES <hwnd>=<titel>\t...") und mit einer Taste durchschalten (wie EVE-X-Preview):
//     Ist ein EVE-Client vorne und die eingestellte Taste wird gedrueckt, holt der Hilfsprozess den naechsten
//     Client nach vorne. Die Taste selbst wird dann nicht an EVE weitergegeben. An EVE wird nichts gesendet.
// Befehle ueber stdin:
//   BELOW <a> <b>
//   OV <hwnd> 0|1|2                 Overlay-Fenster soll ueber EVE liegen (1, 2 = zuletzt heben: Namen ueber der Vorschau) – der Helfer holt es selbst nach oben, sobald EVE vorne ist
//   CYCLE <an 0|1> <vorVk> <vorMods> <zurueckVk> <zurueckMods> <charakterauswahl-ueberspringen 0|1>
//   ORDER <name>\t<name>...        gewuenschte Reihenfolge (Charakternamen)
//   SKIP <name>\t<name>...         LL6: diese Clients beim Umschalten auslassen (Vorschau-Haken aus)
//   ACTIVATE <hwnd>                 diesen EVE-Client nach vorne holen (nur bekannte EVE-Fenster)
//   VOL <hwnd> <0..100> <stumm 0|1>  AO1: Windows-Lautstärke des EVE-Prozesses zu diesem Fenster (wie Lautstärkemixer);
//                                   gemerkt und alle 2 s erneut gesetzt (Windows legt die Ton-Sitzung erst beim ersten Ton an)
//   VOLOFF                          AO1: alles gemerkte zurück auf 100 %, nicht stumm, und vergessen
// Mods: 1 = Strg, 2 = Umschalt, 4 = Alt, 8 = Win
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public static class EcFg {
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetClipboardSequenceNumber();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint f);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] static extern bool ShowWindowAsync(IntPtr h, int cmd);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern IntPtr GetTopWindow(IntPtr h);
  [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint cmd);
  [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern bool AttachThreadInput(uint a, uint b, bool attach);
  [DllImport("user32.dll")] static extern void SwitchToThisWindow(IntPtr h, bool alt);
  [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
  [DllImport("kernel32.dll")] static extern IntPtr GetModuleHandle(string name);
  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int vk);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int max);
  [DllImport("user32.dll")] static extern int GetWindowTextLength(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int max);
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);
  delegate IntPtr HookProc(int code, IntPtr wp, IntPtr lp);
  [DllImport("user32.dll")] static extern IntPtr SetWindowsHookEx(int id, HookProc fn, IntPtr mod, uint thread);
  [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr h, int code, IntPtr wp, IntPtr lp);
  [DllImport("user32.dll")] static extern int GetMessage(out MSG m, IntPtr h, uint a, uint b);
  [StructLayout(LayoutKind.Sequential)] struct MSG { public IntPtr hwnd; public uint message; public IntPtr wParam; public IntPtr lParam; public uint time; public int x; public int y; }
  [StructLayout(LayoutKind.Sequential)] struct KBD { public uint vk; public uint scan; public uint flags; public uint time; public IntPtr extra; }

  // ---------- Zustand (Zugriff nur unter lock(L)) ----------
  static readonly object L = new object();
  static bool cycOn = false, skipLogin = true;
  static int fwdVk = 9, fwdMods = 0, backVk = 9, backMods = 2;
  static string[] order = new string[0], skipNames = new string[0];
  static List<Client> clients = new List<Client>();   // alle gefundenen EVE-Fenster (unsortiert)
  static List<Client> ring = new List<Client>();      // Reihenfolge zum Durchschalten
  static readonly Dictionary<uint, bool> swallowed = new Dictionary<uint, bool>();   // kein HashSet: liegt in System.Core, das Add-Type evtl. nicht einbindet
  static readonly Queue<long> todo = new Queue<long>();
  static readonly AutoResetEvent wake = new AutoResetEvent(false);
  static HookProc hookFn;   // muss am Leben bleiben
  static long pendT = 0; static int pendAt = 0;       // I4: zuletzt angefordertes Ziel (schnelles Tab-Tab zaehlt weiter)
  static IntPtr hook = IntPtr.Zero;

  public class Client {
    public long Hwnd; public string Title; public string Name;
    public Client(long h, string t){ Hwnd = h; Title = t ?? ""; Name = NameOf(Title); }
  }

  // ---------- reine Logik (auch unter Linux/mono testbar) ----------
  // "EVE - Aria Demo" -> "Aria Demo"; "EVE" (Charakterauswahl) -> ""
  public static string NameOf(string title){
    if (title == null) return "";
    string t = title.Trim();
    if (t.StartsWith("EVE - ")) return t.Substring(6).Trim();
    if (t.StartsWith("EVE -")) return t.Substring(5).Trim();
    return "";
  }
  // Reihenfolge: zuerst die Namen aus der Liste (in dieser Reihenfolge), dann die uebrigen alphabetisch,
  // Fenster in der Charakterauswahl (ohne Namen) am Ende oder gar nicht.
  public static List<Client> Arrange(List<Client> all, string[] ord, bool skip, string[] off){
    List<Client> known = new List<Client>(), rest = new List<Client>(), login = new List<Client>();
    Dictionary<string, int> idx = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
    for (int i = 0; i < ord.Length; i++) if (ord[i] != null && ord[i].Length > 0 && !idx.ContainsKey(ord[i])) idx[ord[i]] = i;
    Dictionary<string, bool> offs = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);   // kein HashSet (System.Core)
    foreach (string o in off ?? new string[0]) offs[o] = true;
    foreach (Client c in all){
      if (c.Name.Length > 0 && offs.ContainsKey(c.Name)) continue;   // LL6
      if (c.Name.Length == 0) login.Add(c);
      else if (idx.ContainsKey(c.Name)) known.Add(c);
      else rest.Add(c);
    }
    known.Sort(delegate(Client a, Client b){ int d = idx[a.Name].CompareTo(idx[b.Name]); return d != 0 ? d : a.Hwnd.CompareTo(b.Hwnd); });
    rest.Sort(delegate(Client a, Client b){ int d = string.Compare(a.Name, b.Name, StringComparison.OrdinalIgnoreCase); return d != 0 ? d : a.Hwnd.CompareTo(b.Hwnd); });
    login.Sort(delegate(Client a, Client b){ return a.Hwnd.CompareTo(b.Hwnd); });
    List<Client> r = new List<Client>(known); r.AddRange(rest);
    if (!skip) r.AddRange(login);
    return r;
  }
  // naechstes Ziel ab dem Fenster, das gerade vorne ist (dir = +1 weiter, -1 zurueck); 0 = keins
  public static long NextOf(List<Client> r, long cur, int dir){
    int n = r.Count;
    if (n == 0) return 0;
    int i = -1;
    for (int k = 0; k < n; k++) if (r[k].Hwnd == cur){ i = k; break; }
    if (i < 0) return r[dir > 0 ? 0 : n - 1].Hwnd;   // z. B. Charakterauswahl vorne, die uebersprungen wird
    if (n == 1) return 0;
    return r[((i + dir) % n + n) % n].Hwnd;
  }
  // Soll ein Tastendruck abgefangen werden? 1 = weiter, -1 = zurueck, 0 = nein
  public static int KeyAction(bool on, uint vk, int mods, int fvk, int fmods, int bvk, int bmods){
    if (!on) return 0;
    if (fvk > 0 && vk == (uint)fvk && mods == fmods) return 1;
    if (bvk > 0 && vk == (uint)bvk && mods == bmods) return -1;
    return 0;
  }
  public static string[] ParseOrder(string line){
    int sp = line.IndexOf(' '); string rest = sp >= 0 ? line.Substring(sp + 1) : "";   // ORDER / SKIP
    List<string> o = new List<string>();
    foreach (string s in rest.Split('\t')){ string t = s.Trim(); if (t.Length > 0) o.Add(t); }
    return o.ToArray();
  }

  // ---------- Windows ----------
  static void Out(string s){ lock (Console.Out){ Console.Out.WriteLine(s); Console.Out.Flush(); } }
  static int Mods(){
    int m = 0;
    if ((GetAsyncKeyState(0x11) & 0x8000) != 0) m |= 1;
    if ((GetAsyncKeyState(0x10) & 0x8000) != 0) m |= 2;
    if ((GetAsyncKeyState(0x12) & 0x8000) != 0) m |= 4;
    if ((GetAsyncKeyState(0x5B) & 0x8000) != 0 || (GetAsyncKeyState(0x5C) & 0x8000) != 0) m |= 8;
    return m;
  }
  static bool IsClient(long h){ foreach (Client c in clients) if (c.Hwnd == h) return true; return false; }

  // Tastatur-Hook: muss schnell sein (Windows entfernt langsame Hooks). Das Umschalten macht ein eigener Thread.
  static IntPtr OnKey(int code, IntPtr wp, IntPtr lp){
    try{
      if (code >= 0){
        KBD k = (KBD)Marshal.PtrToStructure(lp, typeof(KBD));
        int msg = wp.ToInt32();
        bool down = msg == 0x100 || msg == 0x104, up = msg == 0x101 || msg == 0x105;
        bool injected = (k.flags & 0x10) != 0;
        lock (L){
          if (up && swallowed.ContainsKey(k.vk)){ swallowed.Remove(k.vk); return new IntPtr(1); }
          if (down && !injected && cycOn){
            int act = KeyAction(true, k.vk, Mods(), fwdVk, fwdMods, backVk, backMods);
            if (act != 0){
              long fgw = GetForegroundWindow().ToInt64();
              if (IsClient(fgw) && ring.Count >= 2){
                if (!swallowed.ContainsKey(k.vk)){        // gedrueckt halten = nur einmal umschalten
                  swallowed[k.vk] = true;
                  long cur = (pendT != 0 && Environment.TickCount - pendAt < 600 && IsClient(pendT)) ? pendT : fgw;
                  long t = NextOf(ring, cur, act);
                  if (t != 0 && t != fgw){ pendT = t; pendAt = Environment.TickCount; todo.Enqueue(t); wake.Set(); }
                }
                return new IntPtr(1);
              }
            }
          }
        }
      }
    }catch{}
    return CallNextHookEx(hook, code, wp, lp);
  }

  static void Activate(long target){
    IntPtr h = new IntPtr(target);
    if (!IsWindow(h)) return;
    if (IsIconic(h)) ShowWindowAsync(h, 9);   // SW_RESTORE
    IntPtr f = GetForegroundWindow();
    uint pid, me = GetCurrentThreadId();
    uint ft = GetWindowThreadProcessId(f, out pid);
    bool att = ft != 0 && ft != me && AttachThreadInput(me, ft, true);
    BringWindowToTop(h);
    bool ok = SetForegroundWindow(h);
    if (att) AttachThreadInput(me, ft, false);
    if (!ok || GetForegroundWindow() != h){   // S6: kurzer Alt-Druck = Helfer hatte die letzte Eingabe, Windows gibt den Vordergrund frei
      keybd_event(0x12, 0, 0, UIntPtr.Zero); keybd_event(0x12, 0, 2, UIntPtr.Zero);
      ok = SetForegroundWindow(h) && GetForegroundWindow() == h;
    }
    if (!ok){ SwitchToThisWindow(h, true); ok = GetForegroundWindow() == h; }
    Out("SWITCH " + target + " " + (ok ? "ok" : "fehler"));
  }

  static Dictionary<uint, string> pidName = new Dictionary<uint, string>();
  static string ProcName(uint pid){
    string n;
    if (pidName.TryGetValue(pid, out n)) return n;
    n = "";
    try{ n = Process.GetProcessById((int)pid).ProcessName.ToLowerInvariant(); }catch{}
    pidName[pid] = n;
    return n;
  }
  static string lastSig = null;
  static void Scan(){
    List<Client> found = new List<Client>();
    EnumWindows(delegate(IntPtr h, IntPtr l){
      if (!IsWindowVisible(h)) return true;
      int len = GetWindowTextLength(h);
      if (len < 3 || len > 200) return true;
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (ProcName(pid) != "exefile") return true;
      StringBuilder sb = new StringBuilder(len + 2);
      GetWindowText(h, sb, sb.Capacity);
      string t = sb.ToString();
      if (!t.StartsWith("EVE")) return true;
      found.Add(new Client(h.ToInt64(), t));
      return true;
    }, IntPtr.Zero);
    if (pidName.Count > 500) pidName.Clear();
    found.Sort(delegate(Client a, Client b){ return a.Hwnd.CompareTo(b.Hwnd); });
    StringBuilder sig = new StringBuilder();
    foreach (Client c in found){ if (sig.Length > 0) sig.Append('\t'); sig.Append(c.Hwnd).Append('=').Append(c.Title.Replace('\t', ' ')); }
    lock (L){ clients = found; ring = Arrange(clients, order, skipLogin, skipNames); }
    string s = sig.ToString();
    if (s != lastSig){ lastSig = s; Out("EVES " + s); }
  }

  static void Command(string l){
    string[] p = l.Split(' ');
    // Nur wenn das fremde Programm noch vorne ist – kommt BELOW zu spaet (EVE schon wieder vorne), wuerde Windows den Overlays
    // „immer oben“ wegnehmen und sie laegen hinter EVE, bis zum naechsten Wechsel (z. B. Windows-Taste)
    if (p.Length == 3 && p[0] == "OV"){ try{ long h = long.Parse(p[1]); lock (ovs){ if (p[2] == "0") ovs.Remove(h); else ovs[h] = p[2] == "2"; } }catch{} return; }
    if (p.Length == 3 && p[0] == "BELOW"){ try{ if (GetForegroundWindow().ToInt64() != long.Parse(p[2])) return; SetWindowPos(new IntPtr(long.Parse(p[1])), new IntPtr(long.Parse(p[2])), 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010 | 0x0200); }catch{} return; }
    if (p.Length >= 7 && p[0] == "CYCLE"){
      lock (L){
        cycOn = p[1] == "1";
        fwdVk = int.Parse(p[2]); fwdMods = int.Parse(p[3]); backVk = int.Parse(p[4]); backMods = int.Parse(p[5]);
        skipLogin = p[6] != "0";
        ring = Arrange(clients, order, skipLogin, skipNames);
      }
      if (cycOn && hook == IntPtr.Zero) StartHook();
      Out("CYCLE " + (cycOn ? "an" : "aus") + " " + (hook != IntPtr.Zero ? "hook" : "ohnehook"));
      return;
    }
    if (p[0] == "ORDER"){ string[] o = ParseOrder(l); lock (L){ order = o; ring = Arrange(clients, order, skipLogin, skipNames); } return; }
    if (p[0] == "SKIP"){ string[] o = ParseOrder(l); lock (L){ skipNames = o; ring = Arrange(clients, order, skipLogin, skipNames); } return; }   // LL6
    if (p.Length == 4 && p[0] == "VOL"){   // AO1
      long h; int lv; if (!long.TryParse(p[1], out h) || !int.TryParse(p[2], out lv)) return;
      uint pid; GetWindowThreadProcessId(new IntPtr(h), out pid); if (pid == 0 || ProcName(pid) != "exefile") return;
      lock (volWant){ volLvl[pid] = Math.Max(0, Math.Min(100, lv)); volWant[pid] = p[3] == "1" ? -1 : volLvl[pid]; }
      VolTick(); return;
    }
    if (p[0] == "VOLOFF"){
      Dictionary<uint, int> w0 = new Dictionary<uint, int>(), l0 = new Dictionary<uint, int>();
      lock (volWant){ foreach (uint k in volWant.Keys){ w0[k] = 100; l0[k] = 100; } volWant.Clear(); volLvl.Clear(); }
      try{ VolApply(w0, l0); }catch{} return;
    }
    if (p.Length == 2 && p[0] == "ACTIVATE"){
      long h; if (!long.TryParse(p[1], out h)) return;
      QueueActivate(h);
      return;
    }
  }

  static void StartHook(){
    ManualResetEvent ready = new ManualResetEvent(false);
    Thread t = new Thread(delegate(){
      hookFn = OnKey;
      hook = SetWindowsHookEx(13, hookFn, GetModuleHandle(null), 0);   // WH_KEYBOARD_LL
      ready.Set();
      if (hook == IntPtr.Zero) return;
      MSG m;
      while (GetMessage(out m, IntPtr.Zero, 0, 0) > 0){ }
    });
    t.IsBackground = true; t.Start();
    ready.WaitOne(3000);
  }

  public static void QueueActivate(long h){
    bool known; lock (L){ known = IsClient(h); if (known){ pendT = h; pendAt = Environment.TickCount; todo.Enqueue(h); } }
    if (known) wake.Set();
  }
  public static void Report(string s){ Out(s); }

  // ---------- AO1: Lautstärke je EVE-Prozess (Windows Core Audio, alle aktiven Wiedergabegeräte) ----------
  [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorCo { }
  [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDeviceEnumerator { [PreserveSig] int EnumAudioEndpoints(int flow, int mask, out IMMDeviceCollection c); }
  [ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDeviceCollection { [PreserveSig] int GetCount(out int n); [PreserveSig] int Item(int i, out IMMDevice d); }
  [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IMMDevice { [PreserveSig] int Activate(ref Guid iid, int ctx, IntPtr p, [MarshalAs(UnmanagedType.IUnknown)] out object o); }
  [ComImport, Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioSessionManager2 { [PreserveSig] int GetAudioSessionControl(IntPtr a, int b, out IntPtr c); [PreserveSig] int GetSimpleAudioVolume(IntPtr a, int b, out IntPtr c); [PreserveSig] int GetSessionEnumerator(out IAudioSessionEnumerator e); }
  [ComImport, Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioSessionEnumerator { [PreserveSig] int GetCount(out int n); [PreserveSig] int GetSession(int i, [MarshalAs(UnmanagedType.IUnknown)] out object s); }
  [ComImport, Guid("bfb7ff88-7239-4fc9-8fa2-07c950be9c6d"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IAudioSessionControl2 {
    [PreserveSig] int GetState(out int s); [PreserveSig] int GetDisplayName(out IntPtr n); [PreserveSig] int SetDisplayName(IntPtr n, IntPtr g);
    [PreserveSig] int GetIconPath(out IntPtr n); [PreserveSig] int SetIconPath(IntPtr n, IntPtr g); [PreserveSig] int GetGroupingParam(out Guid g); [PreserveSig] int SetGroupingParam(IntPtr g, IntPtr c);
    [PreserveSig] int RegisterAudioSessionNotification(IntPtr n); [PreserveSig] int UnregisterAudioSessionNotification(IntPtr n);
    [PreserveSig] int GetSessionIdentifier(out IntPtr s); [PreserveSig] int GetSessionInstanceIdentifier(out IntPtr s); [PreserveSig] int GetProcessId(out uint pid);
  }
  [ComImport, Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface ISimpleAudioVolume { [PreserveSig] int SetMasterVolume(float v, ref Guid ctx); [PreserveSig] int GetMasterVolume(out float v); [PreserveSig] int SetMute(bool m, ref Guid ctx); [PreserveSig] int GetMute(out bool m); }
  static readonly Dictionary<uint, int> volWant = new Dictionary<uint, int>();   // Prozess-ID → 0..100, -1 = stumm (Lautstärke bleibt)
  static readonly Dictionary<uint, int> volLvl = new Dictionary<uint, int>();
  // Lautstärke-Ziel: Stufe 0..100 und stumm; gibt die Zahl der gefundenen Ton-Sitzungen zurück
  public static int VolApply(Dictionary<uint, int> want, Dictionary<uint, int> lvl){
    int hit = 0; Guid none = Guid.Empty, iid = typeof(IAudioSessionManager2).GUID;
    IMMDeviceEnumerator en = (IMMDeviceEnumerator)new MMDeviceEnumeratorCo(); IMMDeviceCollection col;
    if (en.EnumAudioEndpoints(0, 1, out col) != 0) return 0;   // eRender, DEVICE_STATE_ACTIVE
    int nd; col.GetCount(out nd);
    for (int d = 0; d < nd; d++){
      IMMDevice dev; if (col.Item(d, out dev) != 0) continue;
      object o; if (dev.Activate(ref iid, 23, IntPtr.Zero, out o) != 0) continue;   // CLSCTX_ALL
      IAudioSessionEnumerator se; if (((IAudioSessionManager2)o).GetSessionEnumerator(out se) != 0) continue;
      int ns; se.GetCount(out ns);
      for (int i = 0; i < ns; i++){
        object so; if (se.GetSession(i, out so) != 0) continue;
        uint pid; if (((IAudioSessionControl2)so).GetProcessId(out pid) != 0 || !want.ContainsKey(pid)) continue;
        ISimpleAudioVolume v = (ISimpleAudioVolume)so; float cur; bool mu;
        float t = lvl[pid] / 100f; bool m = want[pid] < 0;
        if (v.GetMasterVolume(out cur) == 0 && Math.Abs(cur - t) > 0.004f) v.SetMasterVolume(t, ref none);
        if (v.GetMute(out mu) == 0 && mu != m) v.SetMute(m, ref none);
        hit++;
      }
    }
    return hit;
  }
  static void VolTick(){
    Dictionary<uint, int> w, l;
    lock (volWant){ if (volWant.Count == 0) return; w = new Dictionary<uint, int>(volWant); l = new Dictionary<uint, int>(volLvl); }
    try{ VolApply(w, l); }catch{}
  }

  [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
  // Overlays, die ueber EVE liegen sollen. Der Helfer sieht den Wechsel zu EVE als Erster und hebt sie sofort (und 0,3 s spaeter
  // nochmal) – so kommt kein verspaeteter Befehl von main.js dazwischen, der sie hinter EVE laesst.
  static readonly Dictionary<long, bool> ovs = new Dictionary<long, bool>();
  static void RaiseOv(){
    List<long> hs; Dictionary<long, bool> nm;
    lock (ovs){ nm = new Dictionary<long, bool>(ovs); }
    // Stapel erhalten: von unten nach oben heben – was vorne lag, bleibt vorne (vorher feste Liste: ein Overlay über einem anderen rutschte darunter)
    Dictionary<long, int> pos = new Dictionary<long, int>(); int i = 0;
    for (IntPtr w = GetTopWindow(IntPtr.Zero); w != IntPtr.Zero && pos.Count < nm.Count && i < 20000; w = GetWindow(w, 2), i++){ long k = w.ToInt64(); if (nm.ContainsKey(k)) pos[k] = i; }   // 2 = GW_HWNDNEXT, i = Abstand von oben
    hs = new List<long>(nm.Keys);
    hs.Sort(delegate(long a, long b){
      if (nm[a] != nm[b]) return nm[a] ? 1 : -1;                                   // S16: Namen (true) zuletzt
      int pa = pos.ContainsKey(a) ? pos[a] : int.MaxValue, pb = pos.ContainsKey(b) ? pos[b] : int.MaxValue;
      return pb.CompareTo(pa);                                                      // weiter unten zuerst
    });
    foreach (long h in hs) SetWindowPos(new IntPtr(h), new IntPtr(-1), 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010 | 0x0200);   // HWND_TOPMOST, ohne Aktivieren
  }

  public static void Run(){
    try{ SetProcessDPIAware(); }catch{}   // echte Bildschirm-Pixel
    Thread input = new Thread(delegate(){
      string l;
      while ((l = Console.In.ReadLine()) != null){ try{ Command(l); }catch{} }
      Environment.Exit(0);
    });
    input.IsBackground = true; input.Start();
    Thread worker = new Thread(delegate(){
      while (true){
        wake.WaitOne();
        while (true){
          long t;
          lock (L){ if (todo.Count == 0) break; t = todo.Dequeue(); while (todo.Count > 0) t = todo.Dequeue(); }   // nur das letzte Ziel zaehlt
          try{ Activate(t); }catch{}
        }
      }
    });
    worker.IsBackground = true; worker.Start();
    IntPtr last = IntPtr.Zero; uint clip = GetClipboardSequenceNumber(); uint myPid = (uint)Process.GetCurrentProcess().Id;
    Out("READY");
    int tick = 0, raiseAt = -1;
    while (true){
      IntPtr h = GetForegroundWindow();
      if (h != last){
        last = h; uint pid; GetWindowThreadProcessId(h, out pid); string n = "";
        try{ n = Process.GetProcessById((int)pid).ProcessName; }catch{}
        // W1: Taskleiste und eigene Vorschau-Fenster sind kein "fremdes Programm" – sonst rutschen alle Overlays hinter sie
        if (pid == myPid) n = "evecore";
        else { StringBuilder cls = new StringBuilder(64); GetClassName(h, cls, 64); string cn = cls.ToString(); if (cn == "Shell_TrayWnd" || cn == "Shell_SecondaryTrayWnd") n = "shell"; }
        if (n == "exefile"){ RaiseOv(); raiseAt = tick + 6; } else raiseAt = -1;
        Out("FG " + h.ToInt64() + " " + n);
      }
      if (tick == raiseAt) RaiseOv();
      uint c = GetClipboardSequenceNumber();
      if (c != clip){ clip = c; Out("CLIP " + c); }
      if (tick++ % 20 == 0){ try{ Scan(); }catch{} }   // EVE-Fenster jede Sekunde neu suchen
      if (tick % 40 == 1) VolTick();   // AO1: alle 2 s – neue Ton-Sitzungen (Client spielt erst jetzt Ton) bekommen ihren Wert
      Thread.Sleep(50);   // Vordergrund-Wechsel schnell melden (Rahmen der Vorschau)
    }
  }
}
