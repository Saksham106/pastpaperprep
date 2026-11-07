// A topic page: a thin wrapper around the shared course-notes page module.
import { courseTopicRoute } from "@/components/course-notes/pages/topic";

const route = courseTopicRoute("ib-chemistry");

export const dynamicParams = false;
export const generateStaticParams = route.generateStaticParams;
export const generateMetadata = route.generateMetadata;
export default route.Page;
