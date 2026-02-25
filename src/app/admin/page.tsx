// ============================================================
// Admin Page — /admin
// ============================================================

import AdminDashboard from "../../components/admin/AdminDashboard";

export const metadata = {
    title: "ArogyaSutra Admin",
    description: "Administration panel for user management",
};

export default function AdminPage() {
    return <AdminDashboard />;
}
