import { AmbassadorLandingPage } from '@/components/AmbassadorLandingPage';

/**
 * Platform-level landing page — promotes becoming a QuizBuzz ambassador generally, not
 * any single organization's program. After signing up once, an ambassador can browse and
 * apply to campaigns from any organization (mirrors the public /contests "browse all"
 * page, which also isn't scoped to one org).
 */
export default function AmbassadorPage() {
    return <AmbassadorLandingPage />;
}
