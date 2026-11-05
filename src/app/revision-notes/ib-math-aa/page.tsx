// Own static route tree: a static segment beats [subject], and keeps the course CSS off the IGCSE pages.
// The course home: a thin wrapper around the shared course-notes page module.
import { courseHomeRoute } from "@/components/course-notes/pages/home";

const route = courseHomeRoute("ib-math-aa");

export const dynamicParams = false;
export const generateStaticParams = route.generateStaticParams;
export const generateMetadata = route.generateMetadata;
export default route.Page;
