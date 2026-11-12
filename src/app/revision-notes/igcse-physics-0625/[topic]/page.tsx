// A topic page: a thin wrapper around the shared course-notes page module.
import { courseTopicRoute } from "@/components/course-notes/pages/topic";

const route = courseTopicRoute("igcse-physics-0625");

export const dynamicParams = false;
export const generateStaticParams = route.generateStaticParams;
export const generateMetadata = route.generateMetadata;
export default route.Page;
