// The command terms: a thin wrapper around the shared course-notes page module.
import { courseCommandTermsRoute } from "@/components/course-notes/pages/command-terms";

const route = courseCommandTermsRoute("ib-math-aa");

export const dynamicParams = false;
export const generateStaticParams = route.generateStaticParams;
export const generateMetadata = route.generateMetadata;
export default route.Page;
