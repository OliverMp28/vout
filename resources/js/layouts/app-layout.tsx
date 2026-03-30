import PortalLayout from '@/layouts/portal-layout';
import type { AppLayoutProps } from '@/types';

export default function AppLayout({ children, ...props }: AppLayoutProps) {
    return (
        <PortalLayout {...props}>{children}</PortalLayout>
    );
}
